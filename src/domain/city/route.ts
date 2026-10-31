export interface Point {
  readonly x: number;
  readonly z: number;
}

/** A closed path, walked by distance from its first point. */
export interface Route {
  readonly points: readonly Point[];
  /** Distance from the start to each point; the last one closes the loop. */
  readonly marks: readonly number[];
  readonly length: number;
}

export interface RoutePosition extends Point {
  /** Angle around the vertical: 0 looks along +z, π/2 along +x. */
  readonly heading: number;
}

const at = (points: readonly Point[], index: number): Point => {
  const point = points[index % points.length];
  if (point === undefined) throw new Error('A route needs points');
  return point;
};

const gap = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.z - a.z);

export function makeRoute(points: readonly Point[]): Route {
  const marks = [0];
  let length = 0;
  points.forEach((point, index) => {
    length += gap(point, at(points, index + 1));
    marks.push(length);
  });
  return { points, marks, length };
}

/** Any distance, even past the end or negative, comes back into the loop. */
export const wrap = (route: Route, distance: number): number =>
  ((distance % route.length) + route.length) % route.length;

export function positionAt(route: Route, distance: number): RoutePosition {
  const d = wrap(route, distance);
  const index = Math.max(
    0,
    route.marks.findIndex((mark) => mark > d),
  );
  const segment = index === 0 ? 0 : index - 1;
  const start = route.marks[segment] ?? 0;
  const from = at(route.points, segment);
  const to = at(route.points, segment + 1);
  const size = gap(from, to);
  const t = size === 0 ? 0 : (d - start) / size;
  return {
    x: from.x + (to.x - from.x) * t,
    z: from.z + (to.z - from.z) * t,
    heading: Math.atan2(to.x - from.x, to.z - from.z),
  };
}

const STEP = 0.5;

/** The distance along the route that passes closest to a point. */
export function distanceAlong(route: Route, point: Point): number {
  let best = 0;
  let closest = Infinity;
  for (let d = 0; d < route.length; d += STEP) {
    const away = gap(positionAt(route, d), point);
    if (away < closest) {
      closest = away;
      best = d;
    }
  }
  return best;
}

/** How far along the route, from `distance`, a point stands in the way; undefined if clear. */
export function firstInTheWay(
  route: Route,
  distance: number,
  point: Point,
  reach: number,
  halfWidth: number,
): number | undefined {
  for (let ahead = 0; ahead <= reach; ahead += STEP) {
    if (gap(positionAt(route, distance + ahead), point) <= halfWidth) return ahead;
  }
  return undefined;
}
