/** A straight street. Earlier streets in a plan are the main ones at crossings. */
export interface Road {
  /** 'x': runs along x at z = `at`; 'z': runs along z at x = `at`. */
  readonly axis: 'x' | 'z';
  readonly at: number;
  readonly from: number;
  readonly to: number;
  readonly width: number;
  readonly sidewalk: number;
}

/** Axis-aligned rectangle on the ground, by its center. */
export interface Rect {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
}

export interface StreetPlan {
  readonly asphalt: readonly (Rect & { readonly road: number })[];
  readonly sidewalks: readonly Rect[];
  readonly dashes: readonly Rect[];
}

type Interval = readonly [number, number];

/** Pieces of [from, to] left after removing the cuts. */
function subtract(from: number, to: number, cuts: readonly Interval[]): Interval[] {
  let pieces: Interval[] = [[from, to]];
  for (const [a, b] of cuts) {
    pieces = pieces.flatMap(([p, q]): Interval[] => {
      if (b <= p || a >= q) return [[p, q]];
      return [...(a > p ? [[p, a] as Interval] : []), ...(b < q ? [[b, q] as Interval] : [])];
    });
  }
  return pieces.filter(([p, q]) => q - p > 0.05);
}

/** Interval that `other` covers along `road` (where it crosses or ends on it), with a margin. */
function crossing(road: Road, other: Road, half: number, line: number): Interval | undefined {
  if (other.axis === road.axis) return undefined;
  const touches = line >= other.from - 0.01 && line <= other.to + 0.01;
  const along = other.at >= road.from - half && other.at <= road.to + half;
  return touches && along ? [other.at - half, other.at + half] : undefined;
}

const rectAlong = (road: Road, line: number, [p, q]: Interval, thickness: number): Rect =>
  road.axis === 'x'
    ? { x: (p + q) / 2, z: line, width: q - p, depth: thickness }
    : { x: line, z: (p + q) / 2, width: thickness, depth: q - p };

/**
 * Lays out asphalt, sidewalks and center dashes so nothing overlaps: a side
 * street stops at the main street's edge, sidewalks open at every crossing,
 * and dashes stay out of crossings and painted crosswalks.
 */
export function planStreets(
  roads: readonly Road[],
  keepDashesOff: readonly Rect[] = [],
): StreetPlan {
  const asphalt: (Rect & { road: number })[] = [];
  const sidewalks: Rect[] = [];
  const dashes: Rect[] = [];

  roads.forEach((road, index) => {
    const others = roads.filter((_, j) => j !== index);
    const major = roads.slice(0, index);

    // Asphalt: cut where an earlier (main) street already is.
    const asphaltCuts = major
      .map((other) => crossing(road, other, other.width / 2, road.at))
      .filter((cut): cut is Interval => cut !== undefined);
    for (const piece of subtract(road.from, road.to, asphaltCuts)) {
      asphalt.push({ ...rectAlong(road, road.at, piece, road.width), road: index });
    }

    // Sidewalks: open where any street crosses; a side street's sidewalk
    // also stops at the main street's sidewalk.
    for (const side of [-1, 1]) {
      const line = road.at + side * (road.width / 2 + road.sidewalk / 2);
      const cuts = others
        .map((other) => {
          const isMajor = major.includes(other);
          const half = other.width / 2 + (isMajor ? other.sidewalk : 0);
          return crossing(road, other, half, line);
        })
        .filter((cut): cut is Interval => cut !== undefined);
      const extended: Interval = [road.from, road.to];
      for (const piece of subtract(extended[0], extended[1], cuts)) {
        sidewalks.push(rectAlong(road, line, piece, road.sidewalk));
      }
    }

    // Center dashes, 1.8 long every 4, away from crossings and crosswalks.
    for (let t = road.from + 2; t < road.to - 1; t += 4) {
      const dash = rectAlong(road, road.at, [t - 0.9, t + 0.9], 0.25);
      const near = others.some((other) => {
        const half = other.width / 2 + 1.5;
        return crossing(road, other, half, road.at) !== undefined && Math.abs(t - other.at) < half;
      });
      const painted = keepDashesOff.some(
        (zone) =>
          Math.abs(dash.x - zone.x) < (dash.width + zone.width) / 2 &&
          Math.abs(dash.z - zone.z) < (dash.depth + zone.depth) / 2,
      );
      if (!near && !painted) dashes.push(dash);
    }
  });

  return { asphalt, sidewalks, dashes };
}

/** A painted crossing on one road: `at` is its position along the road. */
export interface Crossing {
  readonly road: Road;
  readonly at: number;
  readonly width: number;
  /** Has a traffic light: people wait for the green figure. */
  readonly signal?: boolean;
}

export const crossingRect = ({ road, at, width }: Crossing): Rect =>
  road.axis === 'x'
    ? { x: at, z: road.at, width, depth: road.width }
    : { x: road.at, z: at, width: road.width, depth: width };

const BAR_THICKNESS = 0.6;
const BAR_SPACING = 1.2;

/** Zebra bars: long and parallel to the road, in a row across it (as on real streets). */
export function zebraBars(crossing: Crossing): Rect[] {
  const { road, at, width } = crossing;
  const count = Math.floor(road.width / BAR_SPACING);
  const start = road.at - ((count - 1) * BAR_SPACING) / 2;
  return Array.from({ length: count }, (_, index) => {
    const line = start + index * BAR_SPACING;
    return road.axis === 'x'
      ? { x: at, z: line, width, depth: BAR_THICKNESS }
      : { x: line, z: at, width: BAR_THICKNESS, depth: width };
  });
}
