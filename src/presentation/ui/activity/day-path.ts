import { h } from '@presentation/ui/dom';

export interface DayStep {
  readonly icon: string;
  readonly name: string;
  readonly color: string;
  readonly done: boolean;
}

export interface DayBoardCallbacks {
  onChoose(index: number): void;
  onLater(): void;
  onBreathEnd(): void;
  onFinish(): void;
}

/** Three slow breaths, the same length as the animation in the styles. */
const BREATH_MS = 24_000;

/**
 * First, then: what today has, what is done and what comes last, in pictures.
 * The child picks what comes next, so the day is theirs and still has no
 * surprises. The prize is always in the last place.
 */
export class DayBoard {
  readonly element: HTMLElement;
  private readonly sheet = h('div', { className: 'sheet day' });
  private breath: number | undefined;

  constructor(private readonly callbacks: DayBoardCallbacks) {
    this.element = h(
      'section',
      { className: 'overlay', attrs: { 'aria-label': 'Plano de hoje' } },
      [this.sheet],
    );
  }

  show(steps: readonly DayStep[], offerPause: boolean): void {
    this.stopBreath();
    const started = steps.some((step) => step.done);
    this.sheet.replaceChildren(
      h('h2', { className: 'sheet__title', text: '📅 Hoje vamos fazer' }),
      h('div', { className: 'day__path' }, [
        ...steps.map((step, index) => this.card(step, index)),
        h('div', { className: 'day__card day__card--prize', attrs: { 'aria-label': 'Prêmio' } }, [
          h('span', { className: 'day__icon', text: '🎁' }),
          h('span', { className: 'day__name', text: 'Prêmio' }),
        ]),
      ]),
      h('p', {
        className: 'day__hint',
        text: started ? 'O que vem agora?' : 'Por onde vamos começar?',
      }),
      h('div', { className: 'celebration__actions' }, [
        offerPause &&
          h('button', {
            className: 'big-button',
            text: '🌬️ Respirar com o Lilo',
            attrs: { type: 'button' },
            onTap: () => {
              this.showBreath();
            },
          }),
        h('button', {
          className: 'big-button big-button--light',
          text: '🌍 Agora não',
          attrs: { type: 'button' },
          onTap: () => {
            this.callbacks.onLater();
          },
        }),
      ]),
    );
    this.element.classList.add('is-visible');
  }

  showEnd(steps: readonly DayStep[], coins: number): void {
    this.stopBreath();
    this.sheet.replaceChildren(
      h('h2', { className: 'sheet__title', text: '🌟 Hoje você fez' }),
      h(
        'div',
        { className: 'day__path' },
        steps.map((step) =>
          h('div', { className: 'day__card is-done' }, [
            h('span', { className: 'day__icon', text: step.icon }),
            h('span', { className: 'day__name', text: step.name }),
          ]),
        ),
      ),
      h('p', { className: 'day__prize', text: `🎁 🪙 +${coins}` }),
      h('button', {
        className: 'big-button big-button--green',
        text: '🌍 Brincar',
        attrs: { type: 'button' },
        onTap: () => {
          this.callbacks.onFinish();
        },
      }),
    );
    this.element.classList.add('is-visible');
  }

  hide(): void {
    this.stopBreath();
    this.element.classList.remove('is-visible');
  }

  private card(step: DayStep, index: number): HTMLElement {
    const card = h(
      'button',
      {
        className: `day__card${step.done ? ' is-done' : ''}`,
        attrs: { type: 'button', style: `--station:${step.color}` },
        onTap: () => {
          this.callbacks.onChoose(index);
        },
      },
      [
        h('span', { className: 'day__icon', text: step.done ? '✅' : step.icon }),
        h('span', { className: 'day__name', text: step.name }),
      ],
    );
    card.disabled = step.done;
    return card;
  }

  private showBreath(): void {
    const finish = () => {
      this.stopBreath();
      this.callbacks.onBreathEnd();
    };
    this.sheet.replaceChildren(
      h('h2', { className: 'sheet__title', text: '🌬️ Respire com o Lilo' }),
      h('div', { className: 'day__breath', attrs: { 'aria-hidden': 'true' } }),
      h('p', { className: 'day__hint', text: 'Puxe o ar devagar. Solte devagar.' }),
      h('button', {
        className: 'big-button big-button--light',
        text: '➡️ Continuar',
        attrs: { type: 'button' },
        onTap: finish,
      }),
    );
    this.breath = window.setTimeout(finish, BREATH_MS);
  }

  private stopBreath(): void {
    window.clearTimeout(this.breath);
    this.breath = undefined;
  }
}
