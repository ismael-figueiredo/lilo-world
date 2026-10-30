import { clamp } from '@presentation/engine/math';
import { idleInput, type MoveInput } from '@presentation/engine/movement';

/** Buttons of the browser's "standard" gamepad layout (Xbox names; PlayStation in comments). */
export const PadButton = {
  a: 0, // ✕
  b: 1, // ◯
  x: 2, // ▢
  y: 3, // △
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  back: 8,
  start: 9,
  leftStick: 10,
  rightStick: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

export type PadDirection = 'up' | 'down' | 'left' | 'right';

/** What the game wants from a controller in one frame. */
export interface PadFrame {
  readonly move: MoveInput;
  /** Right stick, each axis in [-1, 1] (right and down are positive, like a mouse drag). */
  readonly look: { readonly x: number; readonly y: number };
  /** ▢: uses what is nearby and chooses in panels. */
  readonly select: boolean;
  /** ▢ is down right now, for buttons that adults must hold. */
  readonly selectHeld: boolean;
  /** ✕: jumps, and only that. */
  readonly jump: boolean;
  /** ◯: goes back in panels. */
  readonly back: boolean;
  /** △ or Options. */
  readonly menu: boolean;
  /** Direction pressed this frame, for moving the focus in panels. */
  readonly navigate: PadDirection | undefined;
}

export interface PadState {
  readonly axes: readonly number[];
  readonly pressed: readonly boolean[];
}

const STICK_DEAD_ZONE = 0.2;
const NAV_THRESHOLD = 0.6;

/** Stick to a walking direction: dead zone for loose sticks, "run" near the edge (as on screen). */
export function stickToMove(x: number, y: number, deadZone = STICK_DEAD_ZONE): MoveInput {
  const magnitude = clamp(Math.hypot(x, y), 0, 1);
  if (magnitude < deadZone) return idleInput;
  const scaled = (magnitude - deadZone) / (1 - deadZone);
  const length = Math.hypot(x, y);
  return { x: (x / length) * scaled, y: (-y / length) * scaled, running: magnitude > 0.92 };
}

/** Stick to a smooth camera turn, with a dead zone so a resting stick never drifts. */
export function stickToLook(
  x: number,
  y: number,
  deadZone = STICK_DEAD_ZONE,
): { x: number; y: number } {
  const curve = (value: number) => {
    const size = Math.abs(value);
    if (size < deadZone) return 0;
    const scaled = (size - deadZone) / (1 - deadZone);
    return Math.sign(value) * scaled * scaled;
  };
  return { x: curve(x), y: curve(y) };
}

const directionOf = (state: PadState): PadDirection | undefined => {
  const [x = 0, y = 0] = state.axes;
  if (state.pressed[PadButton.up] === true || y < -NAV_THRESHOLD) return 'up';
  if (state.pressed[PadButton.down] === true || y > NAV_THRESHOLD) return 'down';
  if (state.pressed[PadButton.left] === true || x < -NAV_THRESHOLD) return 'left';
  if (state.pressed[PadButton.right] === true || x > NAV_THRESHOLD) return 'right';
  return undefined;
};

/**
 * Turns two snapshots of a controller into game intent. Buttons count only on
 * the frame they go down, so holding A does not jump or confirm again and again.
 */
export function readPad(previous: PadState, current: PadState): PadFrame {
  const went = (button: number) =>
    current.pressed[button] === true && previous.pressed[button] !== true;
  const [lx = 0, ly = 0, rx = 0, ry = 0] = current.axes;

  let move = stickToMove(lx, ly);
  if (move === idleInput) {
    const dx =
      (current.pressed[PadButton.right] ? 1 : 0) - (current.pressed[PadButton.left] ? 1 : 0);
    const dy = (current.pressed[PadButton.up] ? 1 : 0) - (current.pressed[PadButton.down] ? 1 : 0);
    const length = Math.hypot(dx, dy);
    if (length > 0) move = { x: dx / length, y: dy / length, running: false };
  }
  const runHeld =
    current.pressed[PadButton.rb] === true ||
    current.pressed[PadButton.rt] === true ||
    current.pressed[PadButton.leftStick] === true;
  if (runHeld && move !== idleInput) move = { ...move, running: true };

  const direction = directionOf(current);
  return {
    move,
    look: stickToLook(rx, ry),
    select: went(PadButton.x),
    selectHeld: current.pressed[PadButton.x] === true,
    jump: went(PadButton.a),
    back: went(PadButton.b),
    menu: went(PadButton.y) || went(PadButton.start),
    navigate:
      direction !== undefined && direction !== directionOf(previous) ? direction : undefined,
  };
}

const emptyPad: PadState = { axes: [], pressed: [] };

/** True when the child is using the controller this frame. */
export const padIsActive = (frame: PadFrame): boolean =>
  frame.select ||
  frame.jump ||
  frame.back ||
  frame.menu ||
  frame.navigate !== undefined ||
  frame.move !== idleInput;

export type PadStyle = 'playstation' | 'xbox';

/** Which button names to show. Unknown (generic) controllers get PlayStation symbols. */
export const padStyleOf = (id: string): PadStyle =>
  /xbox|xinput|045e/iu.test(id) ? 'xbox' : 'playstation';

export type PadRole = 'select' | 'jump' | 'back' | 'menu';

export interface PadGlyph {
  readonly symbol: string;
  readonly color: string;
}

/** Each button as it looks on the controller, with its own color. */
export const padGlyphs: Readonly<Record<PadStyle, Readonly<Record<PadRole, PadGlyph>>>> = {
  playstation: {
    select: { symbol: '▢', color: '#e0559e' },
    jump: { symbol: '✕', color: '#2f6fe0' },
    back: { symbol: '◯', color: '#e03a2f' },
    menu: { symbol: '△', color: '#16a36b' },
  },
  xbox: {
    select: { symbol: 'X', color: '#7fb0ff' },
    jump: { symbol: 'A', color: '#4ed39a' },
    back: { symbol: 'B', color: '#ff6b5e' },
    menu: { symbol: 'Y', color: '#ffd23f' },
  },
};

/** Reads the first connected controller (USB or Bluetooth) once per frame. */
export class GamepadReader {
  private previous: PadState = emptyPad;
  private index: number | null = null;

  constructor(onConnect: (connected: boolean) => void) {
    window.addEventListener('gamepadconnected', (event) => {
      if (this.index !== null) return;
      this.index = event.gamepad.index;
      onConnect(true);
    });
    window.addEventListener('gamepaddisconnected', (event) => {
      if (event.gamepad.index !== this.index) return;
      this.index = null;
      this.previous = emptyPad;
      onConnect(false);
    });
  }

  get connected(): boolean {
    return this.index !== null;
  }

  get style(): PadStyle {
    const index = this.index;
    if (index === null || typeof navigator.getGamepads !== 'function') return 'playstation';
    return padStyleOf(navigator.getGamepads()[index]?.id ?? '');
  }

  poll(): PadFrame | undefined {
    if (this.index === null || typeof navigator.getGamepads !== 'function') return undefined;
    const pad = navigator.getGamepads()[this.index];
    if (pad === null || pad === undefined) return undefined;
    const current: PadState = {
      axes: [...pad.axes],
      pressed: pad.buttons.map((button) => button.pressed),
    };
    const frame = readPad(this.previous, current);
    this.previous = current;
    return frame;
  }
}
