import { describe, expect, it } from 'vitest';
import { doorsOnTheWay, routeInside } from '@presentation/world/house-plan';

const bed = { x: -4.7, z: -4.3 };
const table = { x: 3.8, z: 2.6 };
const sink = { x: 2.2, z: -4.2 };

describe('walking inside the house', () => {
  it('needs no door inside one room', () => {
    expect(doorsOnTheWay(bed, { x: -2, z: -4 })).toEqual([]);
  });

  it('goes through the doors in order', () => {
    expect(doorsOnTheWay(bed, table)).toEqual([
      { x: -4.1, z: 0 },
      { x: 0, z: 2.8 },
    ]);
    expect(doorsOnTheWay(table, sink)).toHaveLength(3);
  });

  it('draws a trail of lights that passes through the door', () => {
    const dots = routeInside(bed, table);
    expect(dots.length).toBeGreaterThan(6);
    expect(dots.some((dot) => Math.abs(dot.x) < 0.9 && Math.abs(dot.z - 2.8) < 0.9)).toBe(true);
  });
});
