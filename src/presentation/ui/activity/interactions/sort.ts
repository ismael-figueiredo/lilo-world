import { linksAnswer } from '@domain/activity/activity';
import type { InteractionFactory } from '@presentation/ui/activity/interactions/interaction-view';
import { doneButton, pieceButton, pieceFace } from '@presentation/ui/activity/interactions/pieces';
import { h } from '@presentation/ui/dom';

/**
 * One piece is always in hand: pressing a group puts it there and the next one
 * comes. Any piece of the tray can be taken instead, and one in a group comes back.
 */
export const sortInteraction: InteractionFactory<'sort'> = (interaction, onAnswer) => {
  const tray = h('div', { className: 'pieces__tray' });
  const inTray = () => [...tray.querySelectorAll<HTMLButtonElement>('.piece')];
  let held: HTMLButtonElement | undefined;

  const hold = (piece: HTMLButtonElement | undefined) => {
    held = piece;
    for (const other of pieces) other.classList.toggle('is-chosen', other === piece);
  };
  const placed = (): [string, string][] =>
    groups.flatMap(({ option, box }) =>
      [...box.querySelectorAll<HTMLElement>('.piece')].map((piece): [string, string] => [
        piece.dataset.id ?? '',
        option.id,
      ]),
    );
  const done = doneButton(() => {
    onAnswer(linksAnswer(placed()));
  });
  const refresh = () => {
    done.disabled = inTray().length > 0;
  };

  const pieces = interaction.pieces.map((option) => {
    const piece = pieceButton(option, () => {
      if (piece.parentElement === tray) hold(piece);
      else {
        tray.append(piece);
        hold(piece);
      }
      refresh();
    });
    piece.dataset.id = option.id;
    return piece;
  });

  const groups = interaction.groups.map((option) => {
    const box = h('div', { className: 'pieces__group-box' });
    const button = h(
      'button',
      {
        className: 'pieces__group',
        attrs: { type: 'button', 'aria-label': `Colocar em ${option.label}` },
        onTap: () => {
          if (held === undefined) return;
          box.append(held);
          hold(inTray()[0]);
          refresh();
        },
      },
      [pieceFace(option)],
    );
    return { option, box, button };
  });
  tray.append(...pieces);
  hold(pieces[0]);
  refresh();

  const hinted = (element: HTMLElement | undefined) => {
    for (const piece of pieces) piece.classList.remove('is-hinted');
    for (const { button } of groups) button.classList.remove('is-hinted');
    element?.classList.add('is-hinted');
  };

  return {
    element: h('div', { className: 'mission__shelf pieces' }, [
      tray,
      h(
        'div',
        { className: 'pieces__groups' },
        groups.map(({ button, box }) => h('div', { className: 'pieces__place' }, [button, box])),
      ),
      done,
    ]),
    showAnswer: () => {
      for (const [id, groupId] of interaction.places) {
        const piece = pieces.find((candidate) => candidate.dataset.id === id);
        const group = groups.find(({ option }) => option.id === groupId);
        if (piece !== undefined) group?.box.append(piece);
      }
      hold(undefined);
      for (const piece of pieces) piece.disabled = true;
      for (const { button } of groups) button.disabled = true;
      done.disabled = false;
      done.classList.add('is-hinted');
    },
    nudge: () => {
      const wrong = placed().find(
        ([id, group]) => !interaction.places.some(([p, g]) => p === id && g === group),
      );
      if (wrong !== undefined) {
        hinted(pieces.find((piece) => piece.dataset.id === wrong[0]));
        return;
      }
      const id = held?.dataset.id;
      const place = interaction.places.find(([piece]) => piece === id);
      hinted(groups.find(({ option }) => option.id === place?.[1])?.button ?? done);
    },
  };
};
