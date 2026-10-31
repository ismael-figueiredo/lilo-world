import type { PadFrame } from '@presentation/engine/gamepad';
import { idleInput, keyboardInput, type MoveInput } from '@presentation/engine/movement';

const BLOCKED_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Camera turn from a fully pushed right stick, in "mouse pixels" per second. */
const PAD_LOOK_SPEED = 420;

export const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

/** Keys that work anywhere in the game, the same jobs as on a controller. */
export type GameKey = 'agenda' | 'menu' | 'pause';

export function gameKey(code: string): GameKey | undefined {
  if (code === 'Tab') return 'agenda';
  if (code === 'KeyP') return 'menu';
  if (code === 'KeyC') return 'pause';
  return undefined;
}

const isActionKey = (code: string): boolean => code === 'KeyE' || code === 'Enter';
const isGestureKey = (code: string): boolean => code === 'KeyQ' || code === 'Space';

/**
 * Collects input from keyboard, mouse and touch into one simple state.
 * Dragging on the 3D view turns the camera; the on-screen joystick moves.
 */
export class Input {
  private readonly keys = new Set<string>();
  private joystick: MoveInput = idleInput;
  private pad: MoveInput = idleInput;
  private waitingForRelease = false;
  private gestureQueued = false;
  private actionQueued = false;
  private look = { x: 0, y: 0 };
  private dragPointer: number | null = null;
  private lastPointer = { x: 0, y: 0 };
  enabled = true;
  /** The controls rest, but the child can still look around. */
  lookOnly = false;

  constructor(private readonly surface: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    surface.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  get move(): MoveInput {
    if (!this.enabled) return idleInput;
    const move = this.rawMove();
    if (!this.waitingForRelease) return move;
    if (move.x === 0 && move.y === 0) this.waitingForRelease = false;
    return idleInput;
  }

  /** The child stands still until the stick or keys are let go. */
  stopUntilReleased(): void {
    this.waitingForRelease = true;
  }

  private rawMove(): MoveInput {
    if (this.joystick !== idleInput) return this.joystick;
    return this.pad !== idleInput ? this.pad : keyboardInput(this.keys);
  }

  /** Feeds one frame of the controller. */
  applyPad(frame: PadFrame, dt: number): void {
    this.pad = frame.move;
    this.look.x += frame.look.x * PAD_LOOK_SPEED * dt;
    this.look.y += frame.look.y * PAD_LOOK_SPEED * dt;
    if (frame.gesture) this.gestureQueued = true;
    if (frame.select) this.actionQueued = true;
  }

  /** Only the right stick: the rest of the controller is on a panel. */
  applyPadLook(frame: PadFrame, dt: number): void {
    this.look.x += frame.look.x * PAD_LOOK_SPEED * dt;
    this.look.y += frame.look.y * PAD_LOOK_SPEED * dt;
  }

  setJoystick(input: MoveInput): void {
    this.joystick = input;
  }

  requestGesture(): void {
    this.gestureQueued = true;
  }

  requestAction(): void {
    this.actionQueued = true;
  }

  consumeGesture(): boolean {
    const queued = this.gestureQueued && this.enabled;
    this.gestureQueued = false;
    return queued;
  }

  consumeAction(): boolean {
    const queued = this.actionQueued && this.enabled;
    this.actionQueued = false;
    return queued;
  }

  /** Forgets held keys and the joystick (when a panel opens or the player changes). */
  reset(): void {
    this.keys.clear();
    this.joystick = idleInput;
    this.pad = idleInput;
    this.gestureQueued = false;
    this.actionQueued = false;
    this.look = { x: 0, y: 0 };
  }

  consumeLook(): { x: number; y: number } {
    const look = this.look;
    this.look = { x: 0, y: 0 };
    return this.enabled || this.lookOnly ? look : { x: 0, y: 0 };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.surface.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // Typing a name must never move the character or be blocked.
    if (isTyping(event.target)) return;
    if (BLOCKED_KEYS.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    this.keys.add(event.code);
    if (isGestureKey(event.code)) this.gestureQueued = true;
    if (isActionKey(event.code)) this.actionQueued = true;
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    this.joystick = idleInput;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.dragPointer !== null) return;
    this.dragPointer = event.pointerId;
    this.lastPointer = { x: event.clientX, y: event.clientY };
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointer) return;
    this.look.x += event.clientX - this.lastPointer.x;
    this.look.y += event.clientY - this.lastPointer.y;
    this.lastPointer = { x: event.clientX, y: event.clientY };
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.dragPointer) this.dragPointer = null;
  };
}
