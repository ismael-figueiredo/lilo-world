import { describe, expect, it } from 'vitest';
import { RoadSafety } from '@presentation/world/road-safety';
import { crossingRect, zebraBars, type Road } from '@presentation/world/street-plan';

const road: Road = { axis: 'x', at: 0, from: -50, to: 50, width: 7, sidewalk: 3 };
const asphalt = [{ x: 0, z: 0, width: 100, depth: 7 }];
const painted = crossingRect({ road, at: 10, width: 4 });

const safety = (signal = false) =>
  new RoadSafety(asphalt, [{ rect: painted, signal, across: 'z' }]);

describe('zebra crossing', () => {
  it('has bars parallel to the road, in a row across it', () => {
    const bars = zebraBars({ road, at: 10, width: 4 });
    expect(bars.length).toBeGreaterThanOrEqual(4);
    for (const bar of bars) {
      expect(bar.width).toBeGreaterThan(bar.depth);
      expect(Math.abs(bar.z)).toBeLessThan(3.5);
    }
    expect(new Set(bars.map((b) => b.z)).size).toBe(bars.length);

    const sideRoad: Road = { ...road, axis: 'z', width: 5 };
    for (const bar of zebraBars({ road: sideRoad, at: 10, width: 4 })) {
      expect(bar.depth).toBeGreaterThan(bar.width);
    }
  });
});

describe('road safety', () => {
  it('warns on the road away from a crossing and remembers the sidewalk', () => {
    const tracker = safety();
    expect(tracker.update(-20, 5, true)).toBeUndefined();
    expect(tracker.update(-20, 3, true)).toBe('off-crossing');
    expect(tracker.lastSafeSpot).toEqual({ x: -20, z: 5 });
  });

  it('lets the child cross on the zebra and reports reaching the other side', () => {
    const tracker = safety();
    tracker.update(10, 5, true);
    expect(tracker.update(10, 3, true)).toBeUndefined();
    expect(tracker.update(10, 0, true)).toBeUndefined();
    expect(tracker.update(10, -5, true)).toBe('crossed');
  });

  it('does not count coming back to the same side as crossing', () => {
    const tracker = safety();
    tracker.update(10, 5, true);
    tracker.update(10, 3, true);
    expect(tracker.update(10, 5, true)).toBeUndefined();
  });

  it('asks to wait where there is a traffic light', () => {
    const tracker = safety(true);
    tracker.update(10, 5, false);
    expect(tracker.update(10, 3, false)).toBe('red-light');
    const green = safety(true);
    green.update(10, 5, true);
    expect(green.update(10, 3, true)).toBeUndefined();
    // The light changing while crossing is fine: never a warning halfway.
    expect(green.update(10, 0, false)).toBeUndefined();
  });
});
