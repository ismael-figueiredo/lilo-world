import type { MissionChoice } from '@domain/mission/mission';
import type { HintLevel, MissionAttempt } from '@domain/mission/mission-attempt';
import type { Reward } from '@domain/reward/reward';
import { h, replayAnimation } from '@presentation/ui/dom';

export interface MissionPanelCallbacks {
  onChoose(choiceId: string): void;
  onExit(): void;
  onReplay(): void;
}

/**
 * The shopping list and the shelf. Pictograms first, words second; a wrong
 * tap only makes the right item glow (and then an arrow points at it).
 */
export class MissionPanel {
  readonly element: HTMLElement;
  private readonly list = h('ul', { className: 'mission__list' });
  private readonly shelf = h('div', { className: 'mission__shelf' });
  private readonly title = h('h2', { className: 'mission__title' });
  private readonly celebration = h('div', { className: 'celebration' });
  private readonly tiles = new Map<string, HTMLButtonElement>();
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
          h('div', { className: 'mission__list-card' }, [
            h('p', { className: 'mission__list-title', text: '📝 Lista' }),
            this.list,
          ]),
          this.shelf,
        ]),
      ]),
      this.celebration,
    ]);
  }

  open(attempt: MissionAttempt): void {
    const { mission } = attempt;
    this.title.textContent = mission.title;
    this.tiles.clear();
    this.listItems.clear();
    this.celebration.classList.remove('is-visible');
    this.celebration.replaceChildren();

    const choiceById = new Map(mission.choices.map((choice) => [choice.id, choice]));
    this.list.replaceChildren(
      ...mission.steps.map((step) => {
        const choice = choiceById.get(step.targetId);
        const item = h('li', { className: 'mission__list-item' }, [
          h('span', { className: 'pictogram', text: choice?.pictogram ?? '❓' }),
          h('span', { className: 'mission__list-label', text: choice?.label ?? '' }),
          h('span', { className: 'mission__check', attrs: { 'aria-hidden': 'true' } }),
        ]);
        this.listItems.set(step.targetId, item);
        return item;
      }),
    );
    this.shelf.replaceChildren(...mission.choices.map((choice) => this.createTile(choice)));
    this.highlightCurrent(attempt.currentStep?.targetId);
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
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

  celebrate(reward: Reward): void {
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
  }

  private clearHints(): void {
    for (const tile of this.tiles.values()) tile.classList.remove('is-hinted', 'is-pointed');
  }
}
