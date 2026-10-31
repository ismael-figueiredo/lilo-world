import { describe, expect, it } from 'vitest';
import { makeRoute, positionAt } from '@domain/city/route';
import type { Collider } from '@presentation/world/collision';
import {
  BUS_STOP,
  CAR_LOOP,
  doorToBusStop,
  furnitureColliders,
  ROADS,
  CROSSINGS,
} from '@presentation/world/street-layout';
import { crossingRect, planStreets, type Rect } from '@presentation/world/street-plan';

const CORRIDOR = 1.6;
const STEP = 0.2;
const WALK_SPEED = 3.8;

/** Where a collider blocks a line across the sidewalk, as [from, to] on that line. */
function blockedOn(collider: Collider, along: 'x' | 'z', at: number): [number, number] | undefined {
  if (collider.kind === 'circle') {
    const center = along === 'x' ? collider.x : collider.z;
    const across = along === 'x' ? collider.z : collider.x;
    const half = Math.sqrt(Math.max(0, collider.radius ** 2 - (at - center) ** 2));
    return Math.abs(at - center) <= collider.radius ? [across - half, across + half] : undefined;
  }
  const [min, max, from, to] =
    along === 'x'
      ? [collider.minX, collider.maxX, collider.minZ, collider.maxZ]
      : [collider.minZ, collider.maxZ, collider.minX, collider.maxX];
  return at >= min && at <= max ? [from, to] : undefined;
}

/** The widest free passage at one point of a sidewalk. */
function freeWidth(rect: Rect, along: 'x' | 'z', at: number): number {
  const [start, end] =
    along === 'x'
      ? [rect.z - rect.depth / 2, rect.z + rect.depth / 2]
      : [rect.x - rect.width / 2, rect.x + rect.width / 2];
  const blocks = furnitureColliders
    .map((collider) => blockedOn(collider, along, at))
    .filter((block): block is [number, number] => block !== undefined)
    .sort((a, b) => a[0] - b[0]);
  let widest = 0;
  let cursor = start;
  for (const [from, to] of blocks) {
    widest = Math.max(widest, Math.min(from, end) - cursor);
    cursor = Math.max(cursor, to);
  }
  return Math.max(widest, end - cursor);
}

describe('sidewalks', () => {
  const { sidewalks } = planStreets(ROADS);

  it('always leave a free corridor, with nothing in the way', () => {
    for (const rect of sidewalks) {
      const along = rect.width > rect.depth ? 'x' : 'z';
      const [from, length, side] =
        along === 'x'
          ? [rect.x - rect.width / 2, rect.width, rect.depth]
          : [rect.z - rect.depth / 2, rect.depth, rect.width];
      // The two narrow side streets are all corridor: nothing may stand there.
      const needed = Math.min(CORRIDOR, side);
      for (let t = 0; t <= length; t += STEP) {
        const free = freeWidth(rect, along, from + t);
        expect(free, `${JSON.stringify(rect)} at ${from + t}`).toBeGreaterThanOrEqual(
          needed - 0.001,
        );
      }
    }
  });

  it('keep the bus stop reachable, with the shelter out of the corridor', () => {
    expect(Math.abs(BUS_STOP.shelterZ)).toBeGreaterThan(6.5 + 0.9);
  });

  it('take less than half a minute from the door to the bus stop', () => {
    const way = doorToBusStop({ x: -22, z: 5.4 });
    let meters = 0;
    way.slice(1).forEach((point, index) => {
      const from = way[index] ?? point;
      meters += Math.hypot(point.x - from.x, point.z - from.z);
    });
    expect(meters / WALK_SPEED).toBeLessThan(30);
  });
});

describe('the cars loop', () => {
  const route = makeRoute(CAR_LOOP);
  const { asphalt } = planStreets(ROADS, CROSSINGS.map(crossingRect));

  it('stays on the asphalt all the way around', () => {
    for (let d = 0; d < route.length; d += 0.5) {
      const { x, z } = positionAt(route, d);
      const onRoad = asphalt.some(
        (rect) =>
          Math.abs(x - rect.x) <= rect.width / 2 + 0.01 &&
          Math.abs(z - rect.z) <= rect.depth / 2 + 0.01,
      );
      expect(onRoad, `${x}, ${z}`).toBe(true);
    }
  });
});
