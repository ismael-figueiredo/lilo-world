import type { Challenge, ChallengeOption } from '@domain/learning/challenge';
import { MAX_LEVEL } from '@domain/learning/challenge';
import type { HintLevel } from '@domain/mission/mission-attempt';
import type { ChallengeSession } from '@domain/learning/challenge-session';
import { STREAK_TO_LEVEL_UP } from '@domain/learning/challenge-session';
import type { Sticker } from '@domain/stickers/sticker';
import { h, replayAnimation } from '@presentation/ui/dom';
import type { StationLook } from '@presentation/world/stations';

export interface ChallengePanelCallbacks {
  onChoose(optionId: string): void;
  onExit(): void;
}

/**
 * A learning station: one big question and a few big cards. Dots show the
 * level and how many right answers are left to go up; nothing ever counts down.
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
          h('div', { className: 'challenge__board' }, [this.show, this.question]),
          this.options,
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
    this.render(session);
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }

  /** Shows the session's current challenge (a new one after a right answer). */
  render(session: ChallengeSession): void {
    const { challenge } = session;
    this.levelDots.replaceChildren(
      ...Array.from({ length: MAX_LEVEL }, (_, index) =>
        h('span', {
          className: `challenge__dot${index < session.level ? ' is-on' : ''}`,
          text: '⭐',
        }),
      ),
    );
    this.levelDots.setAttribute('aria-label', `Nível ${session.level}`);
    this.streakDots.classList.toggle('is-hidden', session.isAtTop);
    this.streakDots.replaceChildren(
      ...Array.from({ length: STREAK_TO_LEVEL_UP }, (_, index) =>
        h('span', { className: `challenge__step${index < session.streak ? ' is-on' : ''}` }),
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

  showHint(answerId: string, level: HintLevel): void {
    for (const tile of this.tiles.values()) tile.classList.remove('is-hinted', 'is-pointed');
    const tile = this.tiles.get(answerId);
    if (tile === undefined) return;
    tile.classList.add('is-hinted');
    if (level >= 2) tile.classList.add('is-pointed');
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
    const showLabel = option.label.toUpperCase() !== option.face.toUpperCase();
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
      [
        h('span', { className: 'pictogram pictogram--big challenge__face', text: option.face }),
        showLabel ? h('span', { className: 'tile__label', text: option.label }) : null,
      ],
    );
    this.tiles.set(option.id, tile);
    return tile;
  }
}
