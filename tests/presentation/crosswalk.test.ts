import { describe, expect, it } from 'vitest';
import { CrossingTracker } from '@presentation/world/crosswalk';

const zone = { minX: 5, maxX: 11, roadHalfWidth: 3.5, curbDepth: 2.5 };

describe('crossing tracker', () => {
  it('waits at the curb until the figure is green', () => {
    const tracker = new CrossingTracker(zone);
    expect(tracker.update(8, 5, false, true)).toBeUndefined();
    expect(tracker.update(8, 5, true, true)).toBe('waited');
  });

  it('only hints once when the child steps on the road too early', () => {
    const tracker = new CrossingTracker(zone);
    expect(tracker.update(8, 5, false, true)).toBeUndefined();
    expect(tracker.update(8, 3, false, true)).toBe('rushed');
    expect(tracker.update(8, 2, false, true)).toBeUndefined();
  });

  it('reports crossing when the other sidewalk is reached', () => {
    const tracker = new CrossingTracker(zone);
    tracker.update(8, 5, true, true);
    expect(tracker.update(8, 0, true, false)).toBeUndefined();
    expect(tracker.update(8, 4, true, false)).toBeUndefined();
    expect(tracker.update(8, -4, false, false)).toBe('crossed');
  });

  it('ignores the road far from the crossing', () => {
    const tracker = new CrossingTracker(zone);
    expect(tracker.update(30, 0, false, true)).toBeUndefined();
  });
});
