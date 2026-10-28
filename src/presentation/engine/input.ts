import { idleInput, keyboardInput, type MoveInput } from '@presentation/engine/movement';

const BLOCKED_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * Collects input from keyboard, mouse and touch into one simple state.
 * Dragging on the 3D view turns the camera; the on-screen joystick moves.
 */
export class Input {
  private readonly keys = new Set<string>();
  private joystick: MoveInput = idleInput;
  private jumpQueued = false;
  private actionQueued = false;
  private look = { x: 0, y: 0 };
  private dragPointer: number | null = null;
  private lastPointer = { x: 0, y: 0 };
  enabled = true;

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
    return this.joystick !== idleInput ? this.joystick : keyboardInput(this.keys);
  }

  setJoystick(input: MoveInput): void {
    this.joystick = input;
  }

  requestJump(): void {
    this.jumpQueued = true;
  }

  requestAction(): void {
    this.actionQueued = true;
  }

  consumeJump(): boolean {
    const queued = this.jumpQueued && this.enabled;
    this.jumpQueued = false;
    return queued;
  }

  consumeAction(): boolean {
    const queued = this.actionQueued && this.enabled;
    this.actionQueued = false;
    return queued;
  }

  consumeLook(): { x: number; y: number } {
    const look = this.look;
    this.look = { x: 0, y: 0 };
    return this.enabled ? look : { x: 0, y: 0 };
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
    if (BLOCKED_KEYS.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    this.keys.add(event.code);
    if (event.code === 'Space') this.jumpQueued = true;
    if (event.code === 'KeyE' || event.code === 'Enter') this.actionQueued = true;
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
