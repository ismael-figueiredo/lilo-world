/** Where the child was when they stopped, so the next visit starts in the same place. */
export interface SessionState {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly facing: number;
  readonly cameraYaw: number;
  readonly savedAt: number;
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Returns undefined for missing or broken data: the game then starts at home. */
export function sanitizeSession(raw: unknown): SessionState | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const data = raw as Record<string, unknown>;
  const { x, y, z, facing, cameraYaw, savedAt } = data;
  if (!finite(x) || !finite(y) || !finite(z) || !finite(facing) || !finite(cameraYaw)) {
    return undefined;
  }
  return { x, y, z, facing, cameraYaw, savedAt: finite(savedAt) ? savedAt : 0 };
}

export type SessionTimeStatus =
  | { readonly kind: 'free' }
  | { readonly kind: 'counting'; readonly minutesLeft: number }
  | { readonly kind: 'last-mission'; readonly minutesLeft: number }
  | { readonly kind: 'time-to-rest' };

/** The "last mission" warning starts this long before the limit. */
export const WARNING_MINUTES = 3;

/**
 * Predictable end of play: a visible countdown, a "one more mission" warning,
 * and a calm stop that never interrupts a mission in progress.
 */
export function sessionTimeStatus(
  limitMinutes: number,
  playedMs: number,
  inMission: boolean,
): SessionTimeStatus {
  if (limitMinutes <= 0) return { kind: 'free' };
  const leftMs = limitMinutes * 60_000 - playedMs;
  const minutesLeft = Math.max(0, Math.ceil(leftMs / 60_000));
  if (leftMs <= 0 && !inMission) return { kind: 'time-to-rest' };
  if (leftMs <= WARNING_MINUTES * 60_000) return { kind: 'last-mission', minutesLeft };
  return { kind: 'counting', minutesLeft };
}
