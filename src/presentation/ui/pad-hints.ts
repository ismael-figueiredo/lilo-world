import { padGlyphs, type PadRole, type PadStyle } from '@presentation/engine/gamepad';
import { h } from '@presentation/ui/dom';
import type { Gesture } from '@presentation/ui/controls';

const paint = (element: Element, style: PadStyle, role: PadRole): void => {
  if (!(element instanceof HTMLElement)) return;
  const { symbol, color } = padGlyphs[style][role];
  element.textContent = symbol;
  element.style.backgroundColor = color;
};

const hint = (role: PadRole, text: HTMLElement | string, className: string): HTMLElement =>
  h('span', { className: `pad-hints__item ${className}` }, [
    h('span', { className: 'pad-glyph', attrs: { 'data-role': role } }),
    typeof text === 'string' ? h('span', { text }) : text,
  ]);

const gestureWords: Readonly<Record<Gesture, string>> = { greet: 'acenar', jump: 'pular' };

/** What each button does right now, always in the same place while using a controller. */
export class PadHints {
  private readonly gesture = h('span');
  readonly element = h('div', { className: 'pad-hints', attrs: { 'aria-hidden': 'true' } }, [
    hint('select', 'escolher', 'pad-hints__item--panel'),
    hint('back', 'voltar', 'pad-hints__item--panel'),
    hint('pause', 'pausa', 'pad-hints__item--panel'),
    hint('gesture', this.gesture, 'pad-hints__item--world'),
    hint('agenda', 'agenda', 'pad-hints__item--world'),
    hint('menu', 'menu', 'pad-hints__item--world'),
    hint('pause', 'pausa', 'pad-hints__item--world'),
  ]);

  setGesture(gesture: Gesture): void {
    this.gesture.textContent = gestureWords[gesture];
  }

  setStyle(style: PadStyle): void {
    for (const glyph of this.element.querySelectorAll('[data-role]')) {
      const role = glyph.getAttribute('data-role');
      if (role !== null) paint(glyph, style, role as PadRole);
    }
    // The yellow action button shows the button that presses it.
    for (const glyph of document.querySelectorAll('.action__pad')) paint(glyph, style, 'select');
  }
}
