import type { InteractionFactory } from '@presentation/ui/activity/interactions/interaction-view';
import { h, picture } from '@presentation/ui/dom';

/** Below this distance a press on a piece is a tap, not a drag. */
const DRAG_PX = 12;

const inside = (box: DOMRect, x: number, y: number): boolean =>
  x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;

/**
 * Carrying things one by one, counting along. A piece moves by dragging it or by
 * pressing it, which is also how a controller or a keyboard plays: press again
 * to bring it back. "Pronto" answers, so a miscount can still be fixed.
 */
export const dragInteraction: InteractionFactory<'drag'> = (interaction, onAnswer, onCarry) => {
  const tray = h('div', { className: 'drag__tray' });
  const target = h('div', { className: 'drag__target' }, [
    h('span', { className: 'drag__target-icon', text: interaction.target }),
  ]);
  const done = h('button', {
    className: 'big-button big-button--green drag__done',
    text: '✓ Pronto',
    attrs: { type: 'button' },
    onTap: () => {
      onAnswer(String(carried().length));
    },
  });
  const carried = () => [...target.querySelectorAll<HTMLButtonElement>('.drag__piece')];
  const refresh = () => {
    done.disabled = carried().length === 0;
    onCarry?.(carried().length);
  };
  const toggle = (piece: HTMLButtonElement) => {
    (piece.parentElement === tray ? target : tray).append(piece);
    refresh();
  };

  const pieces = Array.from({ length: interaction.supply }, (_, index) => {
    const piece = h(
      'button',
      {
        className: 'drag__piece',
        attrs: { type: 'button', 'aria-label': `Peça ${index + 1}` },
      },
      [picture(interaction.piece, 'pictogram drag__picture')],
    );
    let startX = 0;
    let startY = 0;
    let dragged = false;
    piece.addEventListener('pointerdown', (event) => {
      startX = event.clientX;
      startY = event.clientY;
      dragged = false;
      piece.setPointerCapture(event.pointerId);
    });
    piece.addEventListener('pointermove', (event) => {
      if (!piece.hasPointerCapture(event.pointerId)) return;
      const x = event.clientX - startX;
      const y = event.clientY - startY;
      if (Math.hypot(x, y) > DRAG_PX) dragged = true;
      if (dragged) piece.style.transform = `translate(${x}px, ${y}px)`;
    });
    piece.addEventListener('pointerup', (event) => {
      piece.style.transform = '';
      if (!dragged) return;
      const over = inside(target.getBoundingClientRect(), event.clientX, event.clientY);
      if (over !== (piece.parentElement === target)) toggle(piece);
    });
    piece.addEventListener('pointercancel', () => {
      piece.style.transform = '';
      dragged = false;
    });
    piece.addEventListener('click', (event) => {
      event.stopPropagation();
      if (dragged) dragged = false;
      else toggle(piece);
    });
    return piece;
  });
  tray.append(...pieces);
  refresh();

  return {
    element: h('div', { className: 'mission__shelf drag' }, [tray, target, done]),
    showAnswer: () => {
      target.append(...pieces.slice(0, interaction.goal));
      tray.append(...pieces.slice(interaction.goal));
      for (const piece of pieces) piece.disabled = true;
      onCarry?.(interaction.goal);
      done.disabled = false;
      done.classList.add('is-hinted');
    },
    nudge: () => {
      const missing = interaction.goal - carried().length;
      const next = [...tray.querySelectorAll<HTMLButtonElement>('.drag__piece')][0];
      for (const piece of pieces) piece.classList.remove('is-hinted');
      next?.classList.toggle('is-hinted', missing > 0);
      done.classList.toggle('is-hinted', missing === 0);
    },
  };
};
