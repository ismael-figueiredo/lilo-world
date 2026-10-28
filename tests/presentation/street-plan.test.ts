import { describe, expect, it } from 'vitest';
import { planStreets, type Rect, type Road } from '@presentation/world/street-plan';

const main: Road = { axis: 'x', at: 0, from: -50, to: 50, width: 7, sidewalk: 3 };
const side: Road = { axis: 'z', at: 10, from: 0, to: 30, width: 5, sidewalk: 1.5 };
const avenue: Road = { axis: 'x', at: 30, from: -20, to: 20, width: 6, sidewalk: 2 };

const overlap = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 0.01 &&
  Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 - 0.01;

describe('street plan', () => {
  const plan = planStreets([main, side, avenue], [{ x: 30, z: 0, width: 6, depth: 6 }]);
  const all = [...plan.asphalt, ...plan.sidewalks];

  it('never puts two pieces of road or sidewalk on top of each other', () => {
    all.forEach((a, i) => {
      for (const b of all.slice(i + 1)) expect(overlap(a, b), JSON.stringify([a, b])).toBe(false);
    });
  });

  it('stops a side street at the main street', () => {
    const sideAsphalt = plan.asphalt.filter((r) => r.road === 1);
    for (const piece of sideAsphalt)
      expect(piece.z - piece.depth / 2).toBeGreaterThanOrEqual(3.5 - 0.01);
  });

  it('opens the main sidewalk where the side street joins', () => {
    const southWalk = plan.sidewalks.filter((r) => r.z === 5);
    expect(southWalk.length).toBe(2);
    expect(southWalk.some((r) => r.x + r.width / 2 <= 7.5 + 0.01)).toBe(true);
  });

  it('keeps dashes off crossings and painted crosswalks', () => {
    for (const dash of plan.dashes) {
      for (const piece of plan.sidewalks) expect(overlap(dash, piece)).toBe(false);
      expect(dash.z === 0 && Math.abs(dash.x - 30) < 4).toBe(false);
      expect(dash.z === 0 && Math.abs(dash.x - 10) < 3).toBe(false);
    }
    expect(plan.dashes.length).toBeGreaterThan(10);
  });
});
