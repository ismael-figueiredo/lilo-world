import type { ActivityOption } from '@domain/activity/activity';
import { h, picture } from '@presentation/ui/dom';

/** What a piece shows: its picture, or a word when reading is the point. */
export const pieceFace = (option: ActivityOption): HTMLElement =>
  option.picture === undefined
    ? h('span', {
        className: `piece__text${(option.text ?? '').length > 4 ? ' piece__text--long' : ''}`,
        text: option.text ?? '',
      })
    : picture(option.picture, 'pictogram piece__picture');

export const pieceButton = (option: ActivityOption, onPress: () => void): HTMLButtonElement =>
  h(
    'button',
    {
      className: 'piece',
      attrs: { type: 'button', 'aria-label': option.label },
      onTap: onPress,
    },
    [pieceFace(option)],
  );

/** "Pronto" answers, so whatever was done can still be changed before it. */
export const doneButton = (onPress: () => void): HTMLButtonElement =>
  h('button', {
    className: 'big-button big-button--green drag__done',
    text: '✓ Pronto',
    attrs: { type: 'button' },
    onTap: onPress,
  });
