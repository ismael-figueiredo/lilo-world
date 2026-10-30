import { h } from '@presentation/ui/dom';

/** Always in the same place: the child can hear the instruction as often as needed. */
export function repeatButton(onRepeat: () => void): HTMLButtonElement {
  return h('button', {
    className: 'repeat-button',
    text: '🔊',
    attrs: { type: 'button', 'aria-label': 'Ouvir de novo' },
    onTap: onRepeat,
  });
}
