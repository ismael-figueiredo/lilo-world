import type { ActivityRound, RoundSummary } from '@domain/activity/activity-round';
import type { Interaction, Spoken } from '@domain/activity/activity';
import { MAX_LEVEL } from '@domain/curriculum/skill';
import type { Sticker } from '@domain/stickers/sticker';
import { dragInteraction } from '@presentation/ui/activity/interactions/drag';
import type { InteractionView } from '@presentation/ui/activity/interactions/interaction-view';
import { tapInteraction } from '@presentation/ui/activity/interactions/tap';
import { renderStimulus } from '@presentation/ui/activity/stimulus';
import { h, replayAnimation } from '@presentation/ui/dom';
import { repeatButton } from '@presentation/ui/repeat-button';
import type { StationLook } from '@presentation/world/stations';

export interface ActivityPanelCallbacks {
  onChoose(optionId: string): void;
  onAgain(): void;
  onExit(): void;
  onRepeat(): void;
  /** What to put on screen for something the game says. */
  written(spoken: Spoken): string;
}

/** What the round's end offers: going on here, or the next thing of the day. */
export type RoundEnding = 'again' | 'leave-only' | 'onward';

const viewOf = (interaction: Interaction, onAnswer: (id: string) => void): InteractionView =>
  interaction.kind === 'tap'
    ? tapInteraction(interaction, onAnswer)
    : dragInteraction(interaction, onAnswer);

/**
 * The same stage for every activity: the way of the day and the round on top,
 * what to look at in the middle, how to answer below. Only that last part
 * changes with the interaction, and rounds always end.
 */
export class ActivityPanel {
  readonly element: HTMLElement;
  private readonly title = h('h2', { className: 'mission__title' });
  private readonly levelDots = h('div', {
    className: 'challenge__dots',
    attrs: { 'aria-hidden': 'true' },
  });
  private readonly streakDots = h('div', { className: 'challenge__dots challenge__dots--streak' });
  private readonly show = h('div', { className: 'challenge__show' });
  private readonly question = h('p', { className: 'challenge__question instruction__text' });
  private readonly options = h('div', { className: 'activity__answers' });
  private view: InteractionView | undefined;
  private readonly toast = h('div', { className: 'challenge__toast' });
  private readonly board: HTMLElement;
  private readonly result = h('div', { className: 'challenge__result is-hidden' });

  constructor(private readonly callbacks: ActivityPanelCallbacks) {
    this.board = h('div', { className: 'challenge__board' }, [
      this.show,
      h('div', { className: 'instruction' }, [
        repeatButton(() => {
          callbacks.onRepeat();
        }),
        this.question,
      ]),
    ]);
    const exit = h('button', {
      className: 'panel__close',
      text: '✕',
      attrs: { type: 'button', 'aria-label': 'Sair da estação' },
      onTap: () => {
        callbacks.onExit();
      },
    });
    this.element = h(
      'section',
      { className: 'mission challenge', attrs: { 'aria-label': 'Estação de aprendizado' } },
      [
        h('div', { className: 'mission__sheet' }, [
          exit,
          h('div', { className: 'challenge__header' }, [
            this.title,
            this.levelDots,
            this.streakDots,
          ]),
          this.board,
          this.options,
          this.result,
          this.toast,
        ]),
      ],
    );
  }

  open(look: StationLook, round: ActivityRound): void {
    this.title.dataset.icon = look.icon;
    this.element.style.setProperty('--station', look.color);
    this.title.textContent = `${look.icon} ${look.name}`;
    this.toast.classList.remove('is-visible');
    this.result.classList.add('is-hidden');
    this.board.classList.remove('is-hidden');
    this.options.classList.remove('is-hidden');
    this.render(round);
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }

  /** Shows the round's current question (a new one after a right answer). */
  render(round: ActivityRound): void {
    const { item } = round;
    this.paintLevel(round.level);
    this.streakDots.replaceChildren(
      ...Array.from({ length: round.length }, (_, index) =>
        h('span', { className: `challenge__step${index < round.asked ? ' is-on' : ''}` }),
      ),
    );
    const stimulus = renderStimulus(item.stimulus);
    this.show.replaceChildren(...(stimulus === null ? [] : [stimulus]));
    this.show.classList.toggle('is-hidden', item.stimulus.kind === 'none');
    this.question.textContent = this.callbacks.written(item.prompt);
    this.view = viewOf(item.interaction, (answerId) => {
      this.callbacks.onChoose(answerId);
    });
    this.options.replaceChildren(this.view.element);
    replayAnimation(this.options, 'is-new');
  }

  private paintLevel(level: number): void {
    this.levelDots.replaceChildren(
      ...Array.from({ length: MAX_LEVEL }, (_, index) =>
        h('span', { className: `challenge__dot${index < level ? ' is-on' : ''}`, text: '⭐' }),
      ),
    );
    this.levelDots.setAttribute('aria-label', `Nível ${level}`);
  }

  /** The answer is shown: only the right way stays active. */
  showAnswer(): void {
    this.view?.showAnswer();
  }

  /** False when this way of answering has no gentler help than showing the answer. */
  nudge(): boolean {
    this.view?.nudge?.();
    return this.view?.nudge !== undefined;
  }

  /**
   * The end of a round: what was done, and the choice to go on or stop. It
   * never counts points: help and demonstrations are not mistakes.
   */
  showResult(summary: RoundSummary, coins: number, ending: RoundEnding): void {
    this.board.classList.add('is-hidden');
    this.options.classList.add('is-hidden');
    this.toast.classList.remove('is-visible');
    if (summary.reachedLevel !== undefined) this.paintLevel(summary.reachedLevel);
    for (const step of this.streakDots.children) step.classList.add('is-on');
    this.result.replaceChildren(
      h('p', { className: 'challenge__result-title', text: resultTitle(summary) }),
      ...(coins > 0
        ? [h('p', { className: 'challenge__result-score', text: `🪙 +${coins}` })]
        : []),
      h('div', { className: 'celebration__actions' }, [
        ending === 'again' &&
          h('button', {
            className: 'big-button big-button--green',
            text: '🔁 Mais uma rodada',
            attrs: { type: 'button' },
            onTap: () => {
              this.callbacks.onAgain();
            },
          }),
        h('button', {
          className: 'big-button',
          text: ending === 'onward' ? '➡️ Continuar' : '🌍 Sair',
          attrs: { type: 'button' },
          onTap: () => {
            this.callbacks.onExit();
          },
        }),
      ]),
    );
    this.result.classList.remove('is-hidden');
  }

  /** A short, happy note: right answer, new level or a new sticker. */
  celebrate(text: string, sticker?: Sticker): void {
    this.toast.replaceChildren(
      ...(sticker === undefined
        ? [h('span', { text })]
        : [
            h('span', { className: 'challenge__sticker', text: sticker.picture }),
            h('span', { text: `${text} ${sticker.name}` }),
          ]),
    );
    this.toast.classList.add('is-visible');
    replayAnimation(this.toast, 'is-popping');
  }

  hideToast(): void {
    this.toast.classList.remove('is-visible');
  }
}

const resultTitle = (summary: RoundSummary): string => {
  if (summary.shortened === true) return '🌱 Por hoje está ótimo!';
  if (summary.reachedLevel !== undefined) return '🎉 Você subiu de nível!';
  return summary.score >= summary.total - 1 ? '🎉 Muito bem!' : '🌱 Você praticou!';
};
