import type { Challenge, ChallengeOption } from '@domain/learning/challenge';
import { MAX_LEVEL } from '@domain/learning/challenge';
import type { ChallengeSession } from '@domain/learning/challenge-session';
import { ROUND_LENGTH, type RoundSummary } from '@domain/learning/challenge-session';
import type { Sticker } from '@domain/stickers/sticker';
import { h, replayAnimation } from '@presentation/ui/dom';
import type { StationLook } from '@presentation/world/stations';

export interface ChallengePanelCallbacks {
  onChoose(optionId: string): void;
  onAgain(): void;
  onExit(): void;
}

/**
 * A learning station: one big question and a few big cards, in rounds that
 * always end. Dots show how far the round has come. Cards carry no words: a
 * label under the picture would give the answer away.
 */
export class ChallengePanel {
  readonly element: HTMLElement;
  private readonly title = h('h2', { className: 'mission__title' });
  private readonly levelDots = h('div', {
    className: 'challenge__dots',
    attrs: { 'aria-hidden': 'true' },
  });
  private readonly streakDots = h('div', { className: 'challenge__dots challenge__dots--streak' });
  private readonly show = h('p', { className: 'challenge__show' });
  private readonly question = h('p', { className: 'challenge__question' });
  private readonly options = h('div', { className: 'mission__shelf challenge__options' });
  private readonly toast = h('div', { className: 'challenge__toast' });
  private readonly tiles = new Map<string, HTMLButtonElement>();
  private readonly board = h('div', { className: 'challenge__board' }, [this.show, this.question]);
  private readonly result = h('div', { className: 'challenge__result is-hidden' });

  constructor(private readonly callbacks: ChallengePanelCallbacks) {
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

  open(look: StationLook, session: ChallengeSession): void {
    this.title.dataset.icon = look.icon;
    this.element.style.setProperty('--station', look.color);
    this.title.textContent = `${look.icon} ${look.name}`;
    this.toast.classList.remove('is-visible');
    this.result.classList.add('is-hidden');
    this.board.classList.remove('is-hidden');
    this.options.classList.remove('is-hidden');
    this.render(session);
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }

  /** Shows the session's current challenge (a new one after a right answer). */
  render(session: ChallengeSession): void {
    const { challenge } = session;
    this.paintLevel(session.level);
    this.streakDots.replaceChildren(
      ...Array.from({ length: ROUND_LENGTH }, (_, index) =>
        h('span', { className: `challenge__step${index < session.asked ? ' is-on' : ''}` }),
      ),
    );
    this.show.textContent = challenge.show;
    this.show.classList.toggle('challenge__show--word', /^[A-ZÀ-Ú]+$/u.test(challenge.show));
    this.question.textContent = challenge.question;
    this.tiles.clear();
    this.options.replaceChildren(
      ...challenge.options.map((option) => this.createTile(challenge, option)),
    );
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

  /** Not this card: only the right one stays active, with an arrow. */
  showAnswer(answerId: string): void {
    for (const [id, tile] of this.tiles) {
      const right = id === answerId;
      tile.disabled = !right;
      tile.classList.toggle('is-dimmed', !right);
      tile.classList.toggle('is-hinted', right);
      tile.classList.toggle('is-pointed', right);
    }
  }

  /** The end of a round: how it went, and the choice to go on or stop. */
  showResult(summary: RoundSummary, coins: number): void {
    this.board.classList.add('is-hidden');
    this.options.classList.add('is-hidden');
    this.toast.classList.remove('is-visible');
    if (summary.reachedLevel !== undefined) this.paintLevel(summary.reachedLevel);
    const stars = Array.from({ length: summary.total }, (_, index) =>
      h('span', {
        className: `challenge__dot${index < summary.score ? ' is-on' : ''}`,
        text: '⭐',
      }),
    );
    this.result.replaceChildren(
      h('p', { className: 'challenge__result-title', text: resultTitle(summary) }),
      h('div', { className: 'challenge__result-stars' }, stars),
      h('p', {
        className: 'challenge__result-score',
        text: `${summary.score} de ${summary.total}   🪙 +${coins}`,
      }),
      h('div', { className: 'celebration__actions' }, [
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
          text: '🌍 Sair',
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

  private createTile(challenge: Challenge, option: ChallengeOption): HTMLButtonElement {
    const tile = h(
      'button',
      {
        className: `tile challenge__tile challenge__tile--${challenge.skill}`,
        attrs: { type: 'button', 'aria-label': option.label },
        onTap: () => {
          replayAnimation(tile, 'is-tapped');
          this.callbacks.onChoose(option.id);
        },
      },
      [h('span', { className: 'pictogram pictogram--big challenge__face', text: option.face })],
    );
    this.tiles.set(option.id, tile);
    return tile;
  }
}

const resultTitle = (summary: RoundSummary): string => {
  if (summary.reachedLevel !== undefined) return '🎉 Você subiu de nível!';
  return summary.score >= summary.total - 1 ? '🎉 Muito bem!' : '🌱 Você está aprendendo!';
};
