/** Small, dependency-free math helpers shared by the 3D code (and easy to unit test). */

export type Random = () => number;

/** Deterministic random numbers: the same seed always builds the same island. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent smoothing factor for exponential damping. */
export const damping = (sharpness: number, dt: number): number => 1 - Math.exp(-sharpness * dt);

/** Turns an angle towards a target through the shortest way around. */
export function dampAngle(current: number, target: number, sharpness: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * damping(sharpness, dt);
}

export const randomBetween = (random: Random, min: number, max: number): number =>
  min + random() * (max - min);
