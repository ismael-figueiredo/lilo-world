import { linksAnswer } from '@domain/activity/activity';
import type { InteractionFactory } from '@presentation/ui/activity/interactions/interaction-view';
import { doneButton, pieceButton } from '@presentation/ui/activity/interactions/pieces';
import { h } from '@presentation/ui/dom';

/** Linked pairs share a color and a number, so color is never the only clue. */
const LINK_COLORS = ['#3fa9f5', '#3fae5a', '#e8504c', '#9b6bf2', '#e8a10f'];

/** Press one on the left, then its pair on the right. Pressing a linked one undoes it. */
export const matchInteraction: InteractionFactory<'match'> = (interaction, onAnswer) => {
  const links = new Map<string, string>();
  let chosen: string | undefined;

  const done = doneButton(() => {
    onAnswer(linksAnswer([...links]));
  });
  const paint = () => {
    const froms = [...links.keys()];
    for (const [id, button] of lefts) {
      const index = froms.indexOf(id);
      mark(button, index);
      button.classList.toggle('is-chosen', id === chosen);
    }
    for (const [id, button] of rights) {
      mark(
        button,
        froms.findIndex((from) => links.get(from) === id),
      );
    }
    done.disabled = links.size < interaction.left.length;
  };
  const lefts = new Map(
    interaction.left.map((option) => [
      option.id,
      pieceButton(option, () => {
        if (links.delete(option.id)) chosen = undefined;
        else chosen = chosen === option.id ? undefined : option.id;
        paint();
      }),
    ]),
  );
  const rights = new Map(
    interaction.right.map((option) => [
      option.id,
      pieceButton(option, () => {
        const linked = [...links].find(([, to]) => to === option.id);
        if (linked !== undefined) links.delete(linked[0]);
        else if (chosen !== undefined) {
          links.set(chosen, option.id);
          chosen = interaction.left.find((left) => !links.has(left.id))?.id;
        }
        paint();
      }),
    ]),
  );
  chosen = interaction.left[0]?.id;
  paint();

  return {
    element: h('div', { className: 'mission__shelf pieces' }, [
      h('div', { className: 'pieces__columns' }, [
        h('div', { className: 'pieces__column' }, [...lefts.values()]),
        h('div', { className: 'pieces__column' }, [...rights.values()]),
      ]),
      done,
    ]),
    showAnswer: () => {
      links.clear();
      for (const [from, to] of interaction.pairs) links.set(from, to);
      chosen = undefined;
      paint();
      for (const button of [...lefts.values(), ...rights.values()]) button.disabled = true;
      done.classList.add('is-hinted');
    },
    nudge: () => {
      const pair = interaction.pairs.find(([from, to]) => links.get(from) !== to);
      for (const button of rights.values()) button.classList.remove('is-hinted');
      for (const button of lefts.values()) button.classList.remove('is-hinted');
      if (pair === undefined) {
        done.classList.add('is-hinted');
        return;
      }
      if (chosen === pair[0]) rights.get(pair[1])?.classList.add('is-hinted');
      else lefts.get(pair[0])?.classList.add('is-hinted');
    },
  };
};

function mark(button: HTMLButtonElement, index: number): void {
  const linked = index >= 0;
  button.classList.toggle('is-linked', linked);
  button.style.setProperty('--link', linked ? (LINK_COLORS[index] ?? '') : '');
  button.dataset.link = linked ? String(index + 1) : '';
}
