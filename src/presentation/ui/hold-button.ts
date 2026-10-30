import { h } from '@presentation/ui/dom';
import { HOLD_END, HOLD_START } from '@presentation/ui/pad-focus';

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
  const start = () => {
    if (timer !== undefined) return;
    button.style.setProperty('--hold-ms', `${holdMs}ms`);
    button.classList.add('is-holding');
    timer = window.setTimeout(() => {
      cancel();
      onConfirm();
    }, holdMs);
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    start();
  });
  // Keyboard and controller must also stay down the whole time: same gate as a finger.
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    start();
  });
  button.addEventListener(HOLD_START, start);
  for (const type of ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur', HOLD_END]) {
    button.addEventListener(type, cancel);
  }
  return button;
}
