export interface CircleCollider {
  readonly kind: 'circle';
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

export interface BoxCollider {
  readonly kind: 'box';
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  /** World height of the top. Only tall boxes (buildings, the bus) block the camera. */
  readonly top?: number;
}

export type Collider = CircleCollider | BoxCollider;

export interface Point {
  readonly x: number;
  readonly z: number;
}

/** A round piece of ground, such as a playground. */
export interface Area {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

export const isInsideAny = (areas: readonly Area[], x: number, z: number): boolean =>
  areas.some((area) => Math.hypot(x - area.x, z - area.z) <= area.radius);

export const circle = (x: number, z: number, radius: number): CircleCollider => ({
  kind: 'circle',
  x,
  z,
  radius,
});

export const box = (
  x: number,
  z: number,
  width: number,
  depth: number,
  top?: number,
): BoxCollider => ({
  kind: 'box',
  minX: x - width / 2,
  maxX: x + width / 2,
  minZ: z - depth / 2,
  maxZ: z + depth / 2,
  ...(top === undefined ? {} : { top }),
});

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * How far along the segment `from → to` (0..1) the first tall box is hit, or 1
 * when the view is clear. Keeps the camera from looking through walls.
 */
export function firstObstruction(from: Point3, to: Point3, colliders: readonly Collider[]): number {
  let nearest = 1;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  for (const collider of colliders) {
    if (collider.kind !== 'box' || collider.top === undefined) continue;
    const hit = segmentBoxHit(from, dx, dy, dz, collider, collider.top);
    if (hit !== null && hit < nearest) nearest = hit;
  }
  return nearest;
}

function segmentBoxHit(
  from: Point3,
  dx: number,
  dy: number,
  dz: number,
  b: BoxCollider,
  top: number,
): number | null {
  let enter = 0;
  let exit = 1;
  const axes: readonly [number, number, number, number][] = [
    [from.x, dx, b.minX, b.maxX],
    [from.y, dy, -Infinity, top],
    [from.z, dz, b.minZ, b.maxZ],
  ];
  for (const [origin, direction, min, max] of axes) {
    if (Math.abs(direction) < 1e-9) {
      if (origin < min || origin > max) return null;
      continue;
    }
    let t1 = (min - origin) / direction;
    let t2 = (max - origin) / direction;
    if (t1 > t2) [t1, t2] = [t2, t1];
    enter = Math.max(enter, t1);
    exit = Math.min(exit, t2);
    if (enter > exit) return null;
  }
  return enter;
}

/** Pushes a round body (seen from above) out of every collider it overlaps. */
export function resolveCollisions(
  position: Point,
  radius: number,
  colliders: readonly Collider[],
): Point {
  let { x, z } = position;
  for (const collider of colliders) {
    const pushed =
      collider.kind === 'circle'
        ? pushOutOfCircle(x, z, radius, collider)
        : pushOutOfBox(x, z, radius, collider);
    x = pushed.x;
    z = pushed.z;
  }
  return { x, z };
}

function pushOutOfCircle(x: number, z: number, radius: number, c: CircleCollider): Point {
  const dx = x - c.x;
  const dz = z - c.z;
  const distance = Math.hypot(dx, dz);
  const minDistance = radius + c.radius;
  if (distance >= minDistance) return { x, z };
  if (distance < 1e-6) return { x: c.x + minDistance, z };
  const scale = minDistance / distance;
  return { x: c.x + dx * scale, z: c.z + dz * scale };
}

function pushOutOfBox(x: number, z: number, radius: number, b: BoxCollider): Point {
  const closestX = Math.min(Math.max(x, b.minX), b.maxX);
  const closestZ = Math.min(Math.max(z, b.minZ), b.maxZ);
  const dx = x - closestX;
  const dz = z - closestZ;
  const distance = Math.hypot(dx, dz);

  if (distance > 1e-6) {
    if (distance >= radius) return { x, z };
    const push = (radius - distance) / distance;
    return { x: x + dx * push, z: z + dz * push };
  }

  // The center is inside the box: leave through the nearest side.
  const exits = [
    { x: b.minX - radius, z, cost: x - b.minX },
    { x: b.maxX + radius, z, cost: b.maxX - x },
    { x, z: b.minZ - radius, cost: z - b.minZ },
    { x, z: b.maxZ + radius, cost: b.maxZ - z },
  ];
  exits.sort((a, c) => a.cost - c.cost);
  const exit = exits[0] ?? { x, z };
  return { x: exit.x, z: exit.z };
}
