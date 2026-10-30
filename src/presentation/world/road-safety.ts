import type { Rect } from '@presentation/world/street-plan';

export interface SafetyCrossing {
  readonly rect: Rect;
  readonly signal: boolean;
  /** The direction people walk on it. */
  readonly across: 'x' | 'z';
}

export type RoadEvent =
  /** Stepped on the road away from any crossing. */
  | 'off-crossing'
  /** Started crossing while the figure was red. */
  | 'red-light'
  /** Reached the other side on a crossing. */
  | 'crossed';

/** Extra room around a crossing, so its edges are forgiving. */
const CROSSING_MARGIN = 0.5;
const inside = (rect: Rect, x: number, z: number, margin = 0): boolean =>
  Math.abs(x - rect.x) <= rect.width / 2 + margin &&
  Math.abs(z - rect.z) <= rect.depth / 2 + margin;

/**
 * Follows the child near the streets. It only reports what happened and
 * remembers the last safe spot: the game answers with calm words, never by
 * taking anything away.
 */
export class RoadSafety {
  private safe: { x: number; z: number } | undefined;
  private crossing: SafetyCrossing | undefined;
  private entered = { x: 0, z: 0 };

  constructor(
    private readonly asphalt: readonly Rect[],
    private readonly crossings: readonly SafetyCrossing[],
  ) {}

  /** Where to bring the child back to after a warning. */
  get lastSafeSpot(): { x: number; z: number } | undefined {
    return this.safe;
  }

  update(x: number, z: number, walk: boolean): RoadEvent | undefined {
    const onCrossing = this.crossings.find((c) => inside(c.rect, x, z, CROSSING_MARGIN));
    const onRoad = this.asphalt.some((rect) => inside(rect, x, z));

    if (this.crossing !== undefined && onCrossing === undefined) {
      const { rect, across } = this.crossing;
      const center = across === 'z' ? rect.z : rect.x;
      const before = (across === 'z' ? this.entered.z : this.entered.x) - center;
      const after = (across === 'z' ? z : x) - center;
      this.crossing = undefined;
      if (!onRoad && Math.sign(before) !== Math.sign(after)) {
        this.safe = { x, z };
        return 'crossed';
      }
    }

    if (onCrossing !== undefined) {
      if (this.crossing !== onCrossing) {
        this.crossing = onCrossing;
        this.entered = { x, z };
        if (onCrossing.signal && !walk) return 'red-light';
      }
      return undefined;
    }

    if (onRoad) return 'off-crossing';
    this.safe = { x, z };
    return undefined;
  }

  /** The child was brought back: starts again from the safe spot. */
  reset(): void {
    this.crossing = undefined;
  }
}
