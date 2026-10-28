import { clamp } from '@presentation/engine/math';

export interface MoveInput {
  /** Right is positive. */
  readonly x: number;
  /** Forward is positive. */
  readonly y: number;
  readonly running: boolean;
}

export const idleInput: MoveInput = { x: 0, y: 0, running: false };

/**
 * Converts a finger offset on the virtual joystick into a direction in [-1, 1].
 * A small dead zone ignores shaky fingers; pushing near the edge means "run".
 */
export function joystickInput(
  dx: number,
  dy: number,
  maxRadius: number,
  deadZone = 0.18,
): MoveInput {
  const distance = Math.hypot(dx, dy);
  const magnitude = clamp(distance / maxRadius, 0, 1);
  if (magnitude < deadZone || distance === 0) return idleInput;
  const scaled = (magnitude - deadZone) / (1 - deadZone);
  return {
    x: (dx / distance) * scaled,
    y: (-dy / distance) * scaled,
    running: magnitude > 0.92,
  };
}

/** Keyboard keys to a direction, normalized so diagonals are not faster. */
export function keyboardInput(keys: ReadonlySet<string>): MoveInput {
  const has = (...codes: string[]) => codes.some((code) => keys.has(code));
  const x = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0);
  const y = (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0);
  const length = Math.hypot(x, y);
  const running = has('ShiftLeft', 'ShiftRight');
  return length === 0 ? { ...idleInput, running } : { x: x / length, y: y / length, running };
}

/**
 * Direction on the ground (x, z) for an input relative to the camera. The camera
 * orbits at `yaw` around the player, so "forward" means away from the camera.
 */
export function cameraRelative(input: MoveInput, yaw: number): { x: number; z: number } {
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  return {
    x: rightX * input.x + forwardX * input.y,
    z: rightZ * input.x + forwardZ * input.y,
  };
}
