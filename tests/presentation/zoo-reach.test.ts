import { beforeAll, describe, expect, it, vi } from 'vitest';
import { resolveCollisions } from '@presentation/world/collision';
import type { ZooPark } from '@presentation/world/zoo-park';

const BODY = 0.45;
const STEP = 0.5;

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

describe('the zoo', () => {
  let park: ZooPark;

  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: fakeCanvas });
    const { ZooPark } = await import('@presentation/world/zoo-park');
    park = new ZooPark();
  });

  it('lets the child walk from the gate to every pen and back, without dead ends', () => {
    const start = park.entrance;
    const key = (x: number, z: number) => `${Math.round(x / STEP)},${Math.round(z / STEP)}`;
    const seen = new Set([key(start.x, start.z)]);
    const queue = [{ x: start.x, z: start.z }];
    for (let point = queue.pop(); point !== undefined; point = queue.pop()) {
      for (const [dx, dz] of [
        [STEP, 0],
        [-STEP, 0],
        [0, STEP],
        [0, -STEP],
      ] as const) {
        const x = point.x + dx;
        const z = point.z + dz;
        if (seen.has(key(x, z)) || !park.contains(x, z)) continue;
        const pushed = resolveCollisions({ x, z }, BODY, park.walkColliders);
        if (pushed.x !== x || pushed.z !== z) continue;
        seen.add(key(x, z));
        queue.push({ x, z });
      }
    }
    expect(park.walkPlaces.length).toBeGreaterThanOrEqual(13);
    for (const place of park.walkPlaces) {
      const { x, z } = place.position;
      const near = [...seen].some((cell) => {
        const [i = 0, j = 0] = cell.split(',').map(Number);
        return Math.hypot(i * STEP - x, j * STEP - z) < place.radius;
      });
      expect(near, place.id).toBe(true);
    }
  });
});
