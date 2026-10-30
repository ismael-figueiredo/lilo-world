import { padGlyphs, type PadStyle } from '@presentation/engine/gamepad';
import { h } from '@presentation/ui/dom';

/** Which buttons do what in a panel, always in the same place while using a controller. */
export class PadHints {
  readonly element: HTMLElement;
  private readonly confirm = h('span', { className: 'pad-glyph' });
  private readonly back = h('span', { className: 'pad-glyph' });

  constructor() {
    this.element = h('div', { className: 'pad-hints', attrs: { 'aria-hidden': 'true' } }, [
      h('span', { className: 'pad-hints__item' }, [this.confirm, h('span', { text: 'escolher' })]),
      h('span', { className: 'pad-hints__item' }, [this.back, h('span', { text: 'voltar' })]),
    ]);
  }

  setStyle(style: PadStyle): void {
    const glyphs = padGlyphs[style];
    this.confirm.textContent = glyphs.confirm;
    this.back.textContent = glyphs.back;
    for (const glyph of document.querySelectorAll('.action__pad')) {
      glyph.textContent = glyphs.confirm;
    }
  }
}
