import type { PadDirection } from '@presentation/engine/gamepad';

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const center = (box: Box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/**
 * Index of the box the focus should jump to from `from` in a direction: the
 * closest one ahead, preferring boxes in line over diagonal ones.
 */
export function pickInDirection(
  from: Box,
  candidates: readonly Box[],
  direction: PadDirection,
): number | undefined {
  const origin = center(from);
  let best: number | undefined;
  let bestScore = Infinity;
  candidates.forEach((candidate, index) => {
    const target = center(candidate);
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const ahead =
      direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
    const aside = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (ahead <= 1) return;
    const score = ahead + aside * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

/** Full-screen layers (menus, missions, wardrobe, profiles); the last open one is on top. */
const LAYERS =
  '.overlay.is-visible, .mission.is-visible, .wardrobe.is-visible, .start:not(.is-hidden)';
const FOCUSABLE = 'button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])';

const isShown = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = getComputedStyle(element);
  return style.visibility !== 'hidden' && style.pointerEvents !== 'none';
};

const topLayer = (root: HTMLElement): HTMLElement => {
  const layers = [...root.querySelectorAll<HTMLElement>(LAYERS)];
  return layers.at(-1) ?? root;
};

/** Moves the keyboard focus between the buttons on screen with the controller's D-pad. */
export function moveFocus(ui: HTMLElement, direction: PadDirection): void {
  const root = topLayer(ui);
  const elements = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isShown);
  if (elements.length === 0) return;
  const active = document.activeElement;
  const current = elements.find((element) => element === active);
  if (current === undefined) {
    elements[0]?.focus();
    return;
  }
  const others = elements.filter((element) => element !== current);
  const next = pickInDirection(
    current.getBoundingClientRect(),
    others.map((element) => element.getBoundingClientRect()),
    direction,
  );
  if (next !== undefined) others[next]?.focus();
}

/** Presses the focused button, as a tap would. */
export function pressFocused(ui: HTMLElement): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && topLayer(ui).contains(active)) active.click();
  else moveFocus(ui, 'down');
}
