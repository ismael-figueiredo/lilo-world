import type { ActivityOption } from '@domain/activity/activity';
import type { InteractionFactory } from '@presentation/ui/activity/interactions/interaction-view';
import { h, picture, replayAnimation } from '@presentation/ui/dom';

const face = (option: ActivityOption): HTMLElement =>
  option.picture === undefined
    ? h('span', {
        className: `pictogram pictogram--big challenge__face${(option.text ?? '').length > 3 ? ' challenge__face--long' : ''}`,
        text: option.text ?? '',
      })
    : picture(option.picture, 'pictogram pictogram--big');

/** A few big cards. They carry no words: a label would give the answer away. */
export const tapInteraction: InteractionFactory<'tap'> = (interaction, onAnswer) => {
  const tiles = new Map<string, HTMLButtonElement>();
  const element = h(
    'div',
    { className: 'mission__shelf challenge__options' },
    interaction.options.map((option) => {
      const tile = h(
        'button',
        {
          className: 'tile challenge__tile',
          attrs: { type: 'button', 'aria-label': option.label },
          onTap: () => {
            replayAnimation(tile, 'is-tapped');
            onAnswer(option.id);
          },
        },
        [face(option)],
      );
      tiles.set(option.id, tile);
      return tile;
    }),
  );
  return {
    element,
    showAnswer: () => {
      for (const [id, tile] of tiles) {
        const right = id === interaction.answerId;
        tile.disabled = !right;
        tile.classList.toggle('is-dimmed', !right);
        tile.classList.toggle('is-hinted', right);
        tile.classList.toggle('is-pointed', right);
      }
    },
  };
};
