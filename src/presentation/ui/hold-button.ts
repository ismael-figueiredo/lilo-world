import { h } from '@presentation/ui/dom';

/**
 * A button that must be held for a few seconds. Used for adult-only actions
 * (removing a player, changing the time limit) so children don't trigger them
 * by accident.
 */
export function holdButton(
  label: string,
  onConfirm: () => void,
  options: { holdMs?: number; className?: string } = {},
): HTMLButtonElement {
  const holdMs = options.holdMs ?? 3000;
  const fill = h('span', { className: 'hold__fill', attrs: { 'aria-hidden': 'true' } });
  const button = h(
    'button',
    {
      className: `hold ${options.className ?? ''}`.trim(),
      attrs: { type: 'button', 'aria-label': `${label} (segure)` },
    },
    [fill, h('span', { className: 'hold__label', text: label })],
  );

  let timer: number | undefined;
  const cancel = () => {
    window.clearTimeout(timer);
    timer = undefined;
    button.classList.remove('is-holding');
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.style.setProperty('--hold-ms', `${holdMs}ms`);
    button.classList.add('is-holding');
    timer = window.setTimeout(() => {
      cancel();
      onConfirm();
    }, holdMs);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
    button.addEventListener(type, cancel);
  }
  return button;
}
