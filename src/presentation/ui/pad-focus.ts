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

/** Index of the box closest to `from`, for when the focused button goes away. */
export function pickNearest(from: Box, candidates: readonly Box[]): number | undefined {
  const origin = center(from);
  let best: number | undefined;
  let bestDistance = Infinity;
  candidates.forEach((candidate, index) => {
    const target = center(candidate);
    const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/** Full-screen layers (menus, missions, wardrobe, profiles); the last open one is on top. */
const LAYERS =
  '.overlay.is-visible, .mission.is-visible, .wardrobe.is-visible, .start:not(.is-hidden), .creator.is-visible';
const FOCUSABLE = 'button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])';

/** Sent to a hold button while the controller's button is down, as a finger would hold it. */
export const HOLD_START = 'lilo:hold-start';
export const HOLD_END = 'lilo:hold-end';

const isShown = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = getComputedStyle(element);
  return style.visibility !== 'hidden' && style.pointerEvents !== 'none';
};

const focusOn = (element: HTMLElement | undefined): void => {
  element?.focus({ preventScroll: true });
  element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};

/**
 * Moves the focus between the buttons on screen with the controller. It never
 * lets the focus get lost: when the chosen card is disabled or a panel redraws,
 * the focus goes to the nearest button instead of back to the top.
 */
export class PadFocus {
  private layer: HTMLElement | undefined;
  private lastBox: Box | undefined;
  private holding: HTMLElement | undefined;

  constructor(private readonly root: HTMLElement) {}

  /** Call every frame while the controller is used in a panel. */
  keep(): void {
    const layer = this.topLayer();
    if (layer !== this.layer) {
      this.layer = layer;
      this.lastBox = undefined;
    }
    // No panel is open yet (a fade is running): nothing to focus on.
    if (layer === this.root) return;
    const elements = this.buttons();
    const active = elements.find((element) => element === document.activeElement);
    if (active !== undefined) {
      this.lastBox = active.getBoundingClientRect();
      return;
    }
    if (elements.length === 0) return;
    // Start on a choice: one more press on the close button would leave the panel.
    const choices = elements.filter((element) => !element.matches('.panel__close, .repeat-button'));
    const options = choices.length > 0 ? choices : elements;
    if (this.lastBox === undefined) {
      focusOn(options[0]);
      return;
    }
    const boxes = options.map((element) => element.getBoundingClientRect());
    focusOn(options[pickNearest(this.lastBox, boxes) ?? 0]);
  }

  move(direction: PadDirection): void {
    this.keep();
    const current = document.activeElement;
    const others = this.buttons().filter((element) => element !== current);
    if (!(current instanceof HTMLElement)) return;
    const next = pickInDirection(
      current.getBoundingClientRect(),
      others.map((element) => element.getBoundingClientRect()),
      direction,
    );
    if (next !== undefined) focusOn(others[next]);
  }

  /** Presses the focused button, as a tap would. */
  press(): void {
    this.keep();
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !this.topLayer().contains(active)) return;
    if (active.classList.contains('hold')) {
      this.holding = active;
      active.dispatchEvent(new Event(HOLD_START));
      return;
    }
    active.click();
  }

  /** The controller's button came up: a hold in progress stops here. */
  release(): void {
    this.holding?.dispatchEvent(new Event(HOLD_END));
    this.holding = undefined;
  }

  private topLayer(): HTMLElement {
    return [...this.root.querySelectorAll<HTMLElement>(LAYERS)].at(-1) ?? this.root;
  }

  private buttons(): HTMLElement[] {
    return [...this.topLayer().querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isShown);
  }
}
