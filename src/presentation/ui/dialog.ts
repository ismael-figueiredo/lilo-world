import { h, replayAnimation } from '@presentation/ui/dom';

/** Lilo's speech balloon: one short sentence at a time, also read aloud by the game. */
export class Dialog {
  readonly element: HTMLElement;
  private readonly text = h('p', { className: 'dialog__text' });
  private hideTimer: number | undefined;

  constructor() {
    const face = h('div', { className: 'dialog__face', attrs: { 'aria-hidden': 'true' } }, [
      h('span', { className: 'dialog__eye' }),
      h('span', { className: 'dialog__eye' }),
      h('span', { className: 'dialog__beak' }),
    ]);
    this.element = h(
      'div',
      { className: 'dialog', attrs: { role: 'status', 'aria-live': 'polite' } },
      [face, this.text],
    );
  }

  say(message: string, durationMs = 7000): void {
    this.text.textContent = message;
    this.element.classList.add('is-visible');
    replayAnimation(this.element, 'is-popping');
    window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.element.classList.remove('is-visible');
    }, durationMs);
  }
}
