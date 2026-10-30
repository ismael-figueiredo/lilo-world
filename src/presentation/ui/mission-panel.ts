import type { MissionChoice, MissionKind } from '@domain/mission/mission';
import type { MissionAttempt } from '@domain/mission/mission-attempt';
import type { Reward } from '@domain/reward/reward';
import { shuffled } from '@domain/shared/random';
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
interface Layout {
  readonly title: string;
  readonly revealList: boolean;
  /** Words under the cards. Off where the word would give the answer away. */
  readonly labels: boolean;
}

const layouts: Readonly<Record<MissionKind, Layout>> = {
  'pick-items': { title: '📝 Lista', revealList: true, labels: false },
  'build-sentence': { title: '💬 Minha frase', revealList: false, labels: false },
  sequence: { title: '🔢 Passos', revealList: false, labels: true },
  quiz: { title: '❓ Perguntas', revealList: false, labels: true },
  'world-task': { title: '🎯 Missão', revealList: true, labels: true },
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
 * The list and the shelf. After a wrong tap only the right card stays active,
 * glowing with an arrow, so nothing is solved by trying card after card.
 * Sentences and sequences fill empty slots as the child chooses; a world task
 * shows only a small card at the top, so the child can play in the street.
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
  private groups = new Map<string, string>();
  private readonly collected = new Set<string>();
  private stopWaiting: ((spoken: boolean) => void) | undefined;
  private listItems: HTMLLIElement[] = [];
  private readonly speakArea = h('div', { className: 'mission__speak is-hidden' });

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
            this.speakArea,
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
    this.collected.clear();
    this.celebration.classList.remove('is-visible');
    this.celebration.replaceChildren();

    const choiceById = new Map(mission.choices.map((choice) => [choice.id, choice]));
    this.groups = new Map(mission.choices.map((choice) => [choice.id, choice.group ?? MAIN_GROUP]));
    this.listItems = mission.steps.map((step, index) => {
      const choice = choiceById.get(step.targetId);
      // A step at another counter (the cashier) is named, not answered, on the list.
      const atCounter = choice?.group !== undefined;
      return h('li', { className: 'mission__list-item' }, [
        h('span', { className: 'mission__slot', text: String(index + 1) }),
        h('span', { className: 'pictogram', text: atCounter ? '🧾' : (choice?.pictogram ?? '❓') }),
        h('span', {
          className: 'mission__list-label',
          text: atCounter ? 'pagar' : (choice?.label ?? ''),
        }),
        h('span', { className: 'mission__check', attrs: { 'aria-hidden': 'true' } }),
      ]);
    });
    this.list.replaceChildren(...this.listItems);
    this.speakArea.classList.add('is-hidden');
    this.shelf.classList.remove('is-hidden');
    this.shelf.replaceChildren(
      ...shelfOrder(mission.choices, mission.kind).map((choice) =>
        this.createTile(choice, layout.labels),
      ),
    );
    this.showStep(attempt);
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
    // Leaving on the "Falar" screen must not leave the mission waiting forever.
    this.stopWaiting?.(false);
  }

  /** The child's own sentence, e.g. "Eu quero pão, por favor". */
  sentence(attempt: MissionAttempt): string {
    return spokenSentence(
      attempt.chosen.map(
        (id) => attempt.mission.choices.find((choice) => choice.id === id)?.label ?? '',
      ),
    );
  }

  /** Not this card: only the right one stays active, so there is no guessing. */
  showModel(targetId: string): void {
    this.clearHints();
    for (const [id, tile] of this.tiles) {
      const right = id === targetId;
      tile.disabled = !right;
      tile.classList.toggle('is-dimmed', !right);
      tile.classList.toggle('is-hinted', right);
      tile.classList.toggle('is-pointed', right);
    }
  }

  /** The step just done is marked, and the next one is shown. */
  next(attempt: MissionAttempt, choiceId: string): void {
    this.clearHints();
    const { kind, choices } = attempt.mission;
    // In a quiz the same answer can be right again, so its card stays on the shelf.
    if (kind !== 'quiz') this.collected.add(choiceId);
    for (const [id, tile] of this.tiles) {
      tile.disabled = this.collected.has(id);
      tile.classList.toggle('is-collected', this.collected.has(id));
    }
    const item = this.listItems[attempt.stepIndex - 1];
    if (item !== undefined) {
      item.classList.add('is-done');
      const choice = choices.find((c) => c.id === choiceId);
      if (!layouts[kind].revealList && choice !== undefined) {
        const [picture, label] = [
          item.querySelector('.pictogram'),
          item.querySelector('.mission__list-label'),
        ];
        if (picture !== null) picture.textContent = choice.pictogram;
        if (label !== null) label.textContent = choice.label;
      }
    }
    if (kind === 'quiz') {
      this.shelf.replaceChildren(...shuffled(Math.random, [...this.tiles.values()]));
    }
    this.showStep(attempt);
  }

  /** The finished sentence. Resolves true when the child presses to say it. */
  waitForSpeak(sentence: string): Promise<boolean> {
    this.shelf.classList.add('is-hidden');
    this.shelfTitle.classList.add('is-hidden');
    return new Promise((resolve) => {
      this.stopWaiting = (spoken) => {
        this.stopWaiting = undefined;
        this.speakArea.classList.add('is-hidden');
        resolve(spoken);
      };
      this.speakArea.replaceChildren(
        h('p', { className: 'mission__sentence', text: `${sentence}.` }),
        h('button', {
          className: 'big-button big-button--green',
          text: '🔊 Falar',
          attrs: { type: 'button' },
          onTap: () => {
            this.stopWaiting?.(true);
          },
        }),
      );
      this.speakArea.classList.remove('is-hidden');
    });
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

  private createTile(choice: MissionChoice, label: boolean): HTMLButtonElement {
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
        label ? h('span', { className: 'tile__label', text: choice.label }) : null,
      ],
    );
    this.tiles.set(choice.id, tile);
    return tile;
  }

  private showStep(attempt: MissionAttempt): void {
    const step = attempt.currentStep;
    this.listItems.forEach((item, index) => {
      item.classList.toggle('is-current', index === attempt.stepIndex);
    });
    this.question.textContent = step?.show ?? '';
    this.question.classList.toggle('is-hidden', step?.show === undefined);
    if (step?.show !== undefined) replayAnimation(this.question, 'is-popping');
    // Only the cards of the current step's group are on the shelf (e.g. the cashier's coins).
    if (step === undefined) return;
    const group = this.groups.get(step.targetId) ?? MAIN_GROUP;
    for (const [id, tile] of this.tiles) {
      tile.classList.toggle('is-hidden', (this.groups.get(id) ?? MAIN_GROUP) !== group);
    }
    this.shelf.dataset.group = group;
    this.shelfTitle.textContent = groupTitles[group] ?? '';
    this.shelfTitle.classList.toggle('is-hidden', groupTitles[group] === undefined);
  }

  private clearHints(): void {
    for (const tile of this.tiles.values()) {
      tile.classList.remove('is-hinted', 'is-pointed', 'is-dimmed');
    }
  }
}
