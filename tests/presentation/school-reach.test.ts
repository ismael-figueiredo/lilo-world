import { beforeAll, describe, expect, it, vi } from 'vitest';
import { resolveCollisions } from '@presentation/world/collision';
import type { SchoolBuilding } from '@presentation/world/school-building';

const BODY = 0.45;
const STEP = 0.25;

/** Canvas drawing is not what is tested here: it only has to do nothing. */
function fakeCanvas(): unknown {
  const context: object = new Proxy(
    {},
    {
      get: (_, key) => (key === 'measureText' ? () => ({ width: 10 }) : () => context),
      set: () => true,
    },
  );
  return { width: 0, height: 0, getContext: () => context, style: {} };
}

/** Every point the child can walk to from a start, on a fine grid. */
function walkable(school: SchoolBuilding, from: { x: number; z: number }): Set<string> {
  const key = (x: number, z: number) => `${Math.round(x / STEP)},${Math.round(z / STEP)}`;
  const free = (x: number, z: number) => {
    if (!school.contains(x, z)) return false;
    const pushed = resolveCollisions({ x, z }, BODY, school.walkColliders);
    return pushed.x === x && pushed.z === z;
  };
  const seen = new Set([key(from.x, from.z)]);
  const queue = [from];
  for (let point = queue.pop(); point !== undefined; point = queue.pop()) {
    for (const [dx, dz] of [
      [STEP, 0],
      [-STEP, 0],
      [0, STEP],
      [0, -STEP],
    ] as const) {
      const x = point.x + dx;
      const z = point.z + dz;
      if (seen.has(key(x, z)) || !free(x, z)) continue;
      seen.add(key(x, z));
      queue.push({ x, z });
    }
  }
  return seen;
}

describe('the school', () => {
  let school: SchoolBuilding;

  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: fakeCanvas });
    const { SchoolBuilding } = await import('@presentation/world/school-building');
    school = new SchoolBuilding();
  });

  const reachable = (reach: Set<string>, place: SchoolBuilding['walkPlaces'][number]) => {
    const { x, z } = place.position;
    return [...reach].some((cell) => {
      const [i = 0, j = 0] = cell.split(',').map(Number);
      return Math.hypot(i * STEP - x, j * STEP - z) < place.radius;
    });
  };

  it('lets the child walk from the entrance to everything indoors', () => {
    const reach = walkable(school, school.entrance);
    const indoors = school.walkPlaces.filter((place) => place.id.startsWith('escola:'));
    expect(indoors.length).toBeGreaterThan(5);
    for (const place of indoors) expect(reachable(reach, place), place.id).toBe(true);
  });

  it('lets the child walk to every game of the yard', () => {
    const reach = walkable(school, school.yardSpot('arrive'));
    const games = school.walkPlaces.filter((place) => place.id.startsWith('play:'));
    expect(games.length).toBeGreaterThan(8);
    for (const place of games) expect(reachable(reach, place), place.id).toBe(true);
  });

  it('can walk into every room through its door', () => {
    const reach = walkable(school, school.entrance);
    for (const room of [
      { x: -13, z: 5 },
      { x: 13, z: 5 },
      { x: -9, z: -4 },
      { x: 9, z: -3.5 },
    ]) {
      const spot = school.at(room);
      const cell = `${Math.round(spot.x / STEP)},${Math.round(spot.z / STEP)}`;
      expect(reach.has(cell), JSON.stringify(room)).toBe(true);
    }
  });
});
