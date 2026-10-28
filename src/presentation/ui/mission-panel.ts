import type { MissionChoice, MissionKind } from '@domain/mission/mission';
import type { HintLevel, MissionAttempt } from '@domain/mission/mission-attempt';
import type { Reward } from '@domain/reward/reward';
import { h, replayAnimation } from '@presentation/ui/dom';

export interface MissionPanelCallbacks {
  onChoose(choiceId: string): void;
  onExit(): void;
  onReplay(): void;
}

const MAIN_GROUP = 'main';

/** A heading over the shelf for groups other than the main one. */
const groupTitles: Readonly<Record<string, string>> = { cashier: '🧾 Caixa: pague com moedas' };

/** How each kind of mission shows its list. */
const layouts: Readonly<
  Record<MissionKind, { readonly title: string; readonly revealList: boolean }>
> = {
  'pick-items': { title: '📝 Lista', revealList: true },
  'build-sentence': { title: '💬 Minha frase', revealList: false },
  sequence: { title: '🔢 Passos', revealList: false },
  quiz: { title: '❓ Perguntas', revealList: false },
  'world-task': { title: '🎯 Missão', revealList: true },
};

/**
 * Same order every time (predictable), but not the answer order, so a
 * sequence is never solved by tapping left to right.
 */
export function shelfOrder<T>(items: readonly T[], kind: MissionKind): T[] {
  if (kind !== 'sequence' || items.length < 3) return [...items];
  const odd = items.filter((_, index) => index % 2 === 1);
  const even = items.filter((_, index) => index % 2 === 0);
  return [...odd.reverse(), ...even];
}

/** AAC cards read as one sentence, with commas where they are said. */
export function spokenSentence(labels: readonly string[]): string {
  const text = labels
    .filter(Boolean)
    .join(' ')
    .replace(/ por favor$/u, ', por favor')
    .replace(/^bom dia (?=\S)/u, 'bom dia, ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The list and the shelf. Pictograms first, words second; a wrong tap only
 * makes the right card glow (and then an arrow points at it). Sentences and
 * sequences fill empty slots as the child chooses; a world task shows only a
 * small card at the top, so the child can play in the street.
 */
export class MissionPanel {
  readonly element: HTMLElement;
  private readonly list = h('ul', { className: 'mission__list' });
  private readonly shelf = h('div', { className: 'mission__shelf' });
  private readonly title = h('h2', { className: 'mission__title' });
  private readonly listTitle = h('p', { className: 'mission__list-title' });
  private readonly celebration = h('div', { className: 'celebration' });
  private readonly tiles = new Map<string, HTMLButtonElement>();
  private readonly shelfTitle = h('p', { className: 'mission__shelf-title' });
  /** What the current step shows big (a sound, a thing to sort). */
  private readonly question = h('p', { className: 'mission__question is-hidden' });
  private shows = new Map<string, string>();
  private groups = new Map<string, string>();
  private readonly listItems = new Map<string, HTMLLIElement>();

  constructor(private readonly callbacks: MissionPanelCallbacks) {
    const exit = h('button', {
      className: 'panel__close',
      text: '✕',
      attrs: { type: 'button', 'aria-label': 'Sair da missão' },
      onTap: () => {
        callbacks.onExit();
      },
    });
    this.element = h('section', { className: 'mission', attrs: { 'aria-label': 'Missão' } }, [
      h('div', { className: 'mission__sheet' }, [
        exit,
        this.title,
        h('div', { className: 'mission__body' }, [
          h('div', { className: 'mission__list-card' }, [this.listTitle, this.list]),
          h('div', { className: 'mission__shelf-area' }, [
            this.shelfTitle,
            this.question,
            this.shelf,
          ]),
        ]),
      ]),
      this.celebration,
    ]);
  }

  open(attempt: MissionAttempt): void {
    const { mission } = attempt;
    const layout = layouts[mission.kind];
    this.title.textContent = mission.title;
    this.listTitle.textContent = layout.title;
    this.element.dataset.kind = mission.kind;
    this.element.classList.toggle('mission--task', mission.kind === 'world-task');
    this.element.classList.remove('mission--task-done');
    this.element.classList.toggle('mission--slots', !layout.revealList);
    this.tiles.clear();
    this.listItems.clear();
    this.celebration.classList.remove('is-visible');
    this.celebration.replaceChildren();

    const choiceById = new Map(mission.choices.map((choice) => [choice.id, choice]));
    this.shows = new Map(
      mission.steps.flatMap((step) =>
        step.show === undefined ? [] : [[step.targetId, step.show]],
      ),
    );
    this.groups = new Map(mission.choices.map((choice) => [choice.id, choice.group ?? MAIN_GROUP]));
    this.list.replaceChildren(
      ...mission.steps.map((step, index) => {
        const choice = choiceById.get(step.targetId);
        const item = h('li', { className: 'mission__list-item' }, [
          h('span', { className: 'mission__slot', text: String(index + 1) }),
          // A step at another counter (the cashier) is named, not answered, on the list.
          ...(choice?.group === undefined
            ? [
                h('span', { className: 'pictogram', text: choice?.pictogram ?? '❓' }),
                h('span', { className: 'mission__list-label', text: choice?.label ?? '' }),
              ]
            : [
                h('span', { className: 'pictogram', text: '🧾' }),
                h('span', { className: 'mission__list-label', text: 'pagar' }),
              ]),
          h('span', { className: 'mission__check', attrs: { 'aria-hidden': 'true' } }),
        ]);
        this.listItems.set(step.targetId, item);
        return item;
      }),
    );
    this.shelf.replaceChildren(
      ...shelfOrder(mission.choices, mission.kind).map((choice) => this.createTile(choice)),
    );
    this.highlightCurrent(attempt.currentStep?.targetId);
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }

  /** The sentence built so far, e.g. "Eu quero pão" (for the game to say aloud). */
  sentence(attempt: MissionAttempt): string {
    return spokenSentence(
      attempt.mission.steps.map(
        (step) =>
          attempt.mission.choices.find((choice) => choice.id === step.targetId)?.label ?? '',
      ),
    );
  }

  showHint(targetId: string, level: HintLevel): void {
    this.clearHints();
    const tile = this.tiles.get(targetId);
    if (tile === undefined) return;
    tile.classList.add('is-hinted');
    if (level >= 2) tile.classList.add('is-pointed');
  }

  collect(choiceId: string, nextTargetId?: string): void {
    this.clearHints();
    const tile = this.tiles.get(choiceId);
    if (tile !== undefined) {
      tile.classList.add('is-collected');
      tile.disabled = true;
    }
    this.listItems.get(choiceId)?.classList.add('is-done');
    this.highlightCurrent(nextTargetId);
  }

  /** `result` is what was made or bought (🎂), shown big above the prize. */
  celebrate(reward: Reward, result?: string): void {
    // A task in the street is replayed right there, by walking to it again.
    const canReplay = this.element.dataset.kind !== 'world-task';
    // The celebration covers the screen, also after a task in the street
    // (where the card of steps is no longer needed).
    this.element.classList.toggle('mission--task-done', !canReplay);
    this.element.classList.remove('mission--task');
    const prize = [`🪙 +${reward.coins}`, reward.stars > 0 ? `⭐ +${reward.stars}` : '']
      .filter(Boolean)
      .join('   ');
    const confetti = Array.from({ length: 28 }, (_, index) =>
      h('span', {
        className: 'confetti',
        attrs: { style: `--i:${index}; --x:${(index * 37) % 100}%` },
      }),
    );
    this.celebration.replaceChildren(
      ...confetti,
      h('div', { className: 'celebration__card' }, [
        result === undefined ? null : h('p', { className: 'celebration__result', text: result }),
        h('p', { className: 'celebration__title', text: '🎉 Muito bem! 🎉' }),
        h('p', { className: 'celebration__prize', text: prize }),
        h('div', { className: 'celebration__actions' }, [
          h('button', {
            className: 'big-button',
            text: '🌍 Explorar',
            attrs: { type: 'button' },
            onTap: () => {
              this.callbacks.onExit();
            },
          }),
          canReplay &&
            h('button', {
              className: 'big-button big-button--green',
              text: '🔁 De novo',
              attrs: { type: 'button' },
              onTap: () => {
                this.callbacks.onReplay();
              },
            }),
        ]),
      ]),
    );
    this.celebration.classList.add('is-visible');
  }

  private createTile(choice: MissionChoice): HTMLButtonElement {
    const tile = h(
      'button',
      {
        className: 'tile',
        attrs: { type: 'button', 'aria-label': choice.label },
        onTap: () => {
          replayAnimation(tile, 'is-tapped');
          this.callbacks.onChoose(choice.id);
        },
      },
      [
        h('span', { className: 'pictogram pictogram--big', text: choice.pictogram }),
        h('span', { className: 'tile__label', text: choice.label }),
      ],
    );
    this.tiles.set(choice.id, tile);
    return tile;
  }

  private highlightCurrent(targetId: string | undefined): void {
    for (const [id, item] of this.listItems) item.classList.toggle('is-current', id === targetId);
    const show = targetId === undefined ? undefined : this.shows.get(targetId);
    this.question.textContent = show ?? '';
    this.question.classList.toggle('is-hidden', show === undefined);
    if (show !== undefined) replayAnimation(this.question, 'is-popping');
    // Only the cards of the current step's group are on the shelf (e.g. the cashier's coins).
    if (targetId === undefined) return;
    const group = this.groups.get(targetId) ?? MAIN_GROUP;
    for (const [id, tile] of this.tiles) {
      tile.classList.toggle('is-hidden', (this.groups.get(id) ?? MAIN_GROUP) !== group);
    }
    this.shelf.dataset.group = group;
    this.shelfTitle.textContent = groupTitles[group] ?? '';
    this.shelfTitle.classList.toggle('is-hidden', groupTitles[group] === undefined);
  }

  private clearHints(): void {
    for (const tile of this.tiles.values()) tile.classList.remove('is-hinted', 'is-pointed');
  }
}
