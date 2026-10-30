/** Below this, a wait is not worth a screen: it would only blink. */
const SHOW_AFTER_MS = 300;

/**
 * The same calm screen for every wait. It starts in index.html, so it is on
 * screen before any code arrives.
 */
export class LoadingScreen {
  private readonly element = document.getElementById('splash');
  private readonly fill = this.element?.querySelector<HTMLElement>('.splash__fill');

  /** `done` is between 0 and 1. */
  setProgress(done: number): void {
    if (this.fill) this.fill.style.width = `${Math.round(done * 100)}%`;
  }

  show(): void {
    this.element?.classList.add('is-waiting');
    this.element?.classList.remove('is-gone');
  }

  hide(): void {
    this.element?.classList.add('is-gone');
    this.element?.classList.remove('is-waiting');
  }

  /** Covers a wait of unknown length, only if it takes long enough to be noticed. */
  async during<T>(work: Promise<T>): Promise<T> {
    const timer = window.setTimeout(() => {
      this.show();
    }, SHOW_AFTER_MS);
    try {
      return await work;
    } finally {
      window.clearTimeout(timer);
      this.hide();
    }
  }
}
