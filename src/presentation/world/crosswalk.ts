/** The painted crossing, in city coordinates (the road runs along x). */
export interface CrosswalkZone {
  readonly minX: number;
  readonly maxX: number;
  /** Half the road width: |z| below this is the road. */
  readonly roadHalfWidth: number;
  /** How far onto the sidewalk still counts as "at the curb". */
  readonly curbDepth: number;
}

export type CrossingEvent = 'waited' | 'rushed' | 'crossed';

/**
 * Follows the child at the crossing and reports what happened, so the mission
 * can move on: waiting at the curb until the figure is green, stepping on the
 * road too early (only a gentle hint), and reaching the other side.
 */
export class CrossingTracker {
  private side = 0;
  private wasOnRoad = false;

  constructor(private readonly zone: CrosswalkZone) {}

  /** Call every frame. `waiting` is true while the step is "wait for green". */
  update(x: number, z: number, walk: boolean, waiting: boolean): CrossingEvent | undefined {
    const { minX, maxX, roadHalfWidth, curbDepth } = this.zone;
    const nearX = x >= minX - 1.5 && x <= maxX + 1.5;
    const onRoad = nearX && Math.abs(z) < roadHalfWidth;
    const atCurb =
      nearX && Math.abs(z) >= roadHalfWidth && Math.abs(z) <= roadHalfWidth + curbDepth;

    const steppedOn = onRoad && !this.wasOnRoad;
    this.wasOnRoad = onRoad;

    if (waiting) {
      if (steppedOn && !walk) return 'rushed';
      if (atCurb && walk) {
        this.side = Math.sign(z);
        return 'waited';
      }
      return undefined;
    }
    const otherSide = Math.sign(z) === -this.side && Math.abs(z) > roadHalfWidth + 0.3;
    if (this.side !== 0 && nearX && otherSide) return 'crossed';
    return undefined;
  }
}
