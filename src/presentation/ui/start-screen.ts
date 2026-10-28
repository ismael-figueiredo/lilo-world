import { h } from '@presentation/ui/dom';

/**
 * Title screen. The "Play" tap is also required by browsers before the game
 * may speak, so it doubles as a calm, predictable start.
 */
export class StartScreen {
  readonly element: HTMLElement;
  private readonly status = h('p', { className: 'start__status', text: 'Preparando o mundo…' });
  private readonly play: HTMLButtonElement;

  constructor() {
    this.play = h('button', {
      className: 'big-button big-button--play',
      text: '▶  Jogar',
      attrs: { type: 'button' },
    });
    this.play.hidden = true;
    this.element = h('div', { className: 'start' }, [
      h('div', { className: 'start__card' }, [
        h('div', { className: 'start__logo', attrs: { 'aria-hidden': 'true' } }, [
          h('span', { className: 'dialog__eye' }),
          h('span', { className: 'dialog__eye' }),
          h('span', { className: 'dialog__beak' }),
        ]),
        h('h1', { className: 'start__title', text: 'Lilo World' }),
        this.status,
        this.play,
      ]),
    ]);
  }

  /** Shows the play button and resolves when it is tapped. */
  waitForPlay(): Promise<void> {
    this.status.textContent = 'Tudo pronto!';
    this.play.hidden = false;
    this.play.focus();
    return new Promise((resolve) => {
      this.play.addEventListener(
        'click',
        () => {
          this.element.classList.add('is-leaving');
          window.setTimeout(() => {
            this.element.remove();
          }, 600);
          resolve();
        },
        { once: true },
      );
    });
  }

  fail(message: string): void {
    this.status.textContent = message;
  }
}
