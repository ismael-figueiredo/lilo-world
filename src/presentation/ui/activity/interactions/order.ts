import { orderAnswer } from '@domain/activity/activity';
import type { InteractionFactory } from '@presentation/ui/activity/interactions/interaction-view';
import { doneButton, pieceButton } from '@presentation/ui/activity/interactions/pieces';
import { h } from '@presentation/ui/dom';

/** Pressing a piece puts it in the next free place; pressing it there brings it back. */
export const orderInteraction: InteractionFactory<'order'> = (interaction, onAnswer) => {
  const tray = h('div', { className: 'pieces__tray' });
  const slots = interaction.pieces.map(() => h('div', { className: 'pieces__slot' }));
  const placed = (): string[] =>
    slots.flatMap((slot) => {
      const id = slot.querySelector<HTMLElement>('.piece')?.dataset.id;
      return id === undefined ? [] : [id];
    });
  const done = doneButton(() => {
    onAnswer(orderAnswer(placed()));
  });
  const refresh = () => {
    done.disabled = placed().length < slots.length;
  };

  const pieces = interaction.pieces.map((option) => {
    const piece = pieceButton(option, () => {
      if (piece.parentElement === tray) slots.find((slot) => !slot.firstChild)?.append(piece);
      else tray.append(piece);
      refresh();
    });
    piece.dataset.id = option.id;
    return piece;
  });
  const byId = (id: string | undefined) => pieces.find((piece) => piece.dataset.id === id);
  tray.append(...pieces);
  refresh();

  return {
    element: h('div', { className: 'mission__shelf pieces' }, [
      h('div', { className: 'pieces__slots' }, slots),
      tray,
      done,
    ]),
    showAnswer: () => {
      interaction.answer.forEach((id, index) => {
        const piece = byId(id);
        if (piece !== undefined) slots[index]?.append(piece);
      });
      for (const piece of pieces) piece.disabled = true;
      done.disabled = false;
      done.classList.add('is-hinted');
    },
    nudge: () => {
      const current = placed();
      const wrong = current.findIndex((id, index) => id !== interaction.answer[index]);
      const next = wrong >= 0 ? byId(current[wrong]) : byId(interaction.answer[current.length]);
      for (const piece of pieces) piece.classList.toggle('is-hinted', piece === next);
      done.classList.toggle('is-hinted', next === undefined);
    },
  };
};
