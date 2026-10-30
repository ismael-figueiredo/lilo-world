import { padGlyphs, type PadRole, type PadStyle } from '@presentation/engine/gamepad';
import { h } from '@presentation/ui/dom';

const paint = (element: Element, style: PadStyle, role: PadRole): void => {
  if (!(element instanceof HTMLElement)) return;
  const { symbol, color } = padGlyphs[style][role];
  element.textContent = symbol;
  element.style.backgroundColor = color;
};

const hint = (role: PadRole, text: string, className: string): HTMLElement =>
  h('span', { className: `pad-hints__item ${className}` }, [
    h('span', { className: 'pad-glyph', attrs: { 'data-role': role } }),
    h('span', { text }),
  ]);

/** What each button does right now, always in the same place while using a controller. */
export class PadHints {
  readonly element = h('div', { className: 'pad-hints', attrs: { 'aria-hidden': 'true' } }, [
    hint('select', 'escolher', 'pad-hints__item--panel'),
    hint('back', 'voltar', 'pad-hints__item--panel'),
    hint('jump', 'pular', 'pad-hints__item--world'),
    hint('menu', 'menu', 'pad-hints__item--world'),
  ]);

  setStyle(style: PadStyle): void {
    for (const glyph of this.element.querySelectorAll('[data-role]')) {
      const role = glyph.getAttribute('data-role');
      if (role !== null) paint(glyph, style, role as PadRole);
    }
    // The yellow action button shows the button that presses it.
    for (const glyph of document.querySelectorAll('.action__pad')) paint(glyph, style, 'select');
  }
}
