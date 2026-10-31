import type { Point } from '@domain/city/route';
import { box, circle, type Collider } from '@presentation/world/collision';
import type { Crossing, Road } from '@presentation/world/street-plan';

/** Where things stand in town, kept apart from how they look so it can be tested. */
export const ROAD_WIDTH = 7;
export const SIDEWALK = 3;
const AVENUE = { width: 6, sidewalk: 2 } as const;

/** Middle of the crossing with a traffic light, by the market. */
export const CROSSWALK_X = 8.5;
export const CROSSWALK_WIDTH = 4.4;
/** The crossing the child uses to reach the bus stop. */
export const HOME_CROSSWALK_X = -8;

/** Streets running down from the main street to the avenue (x of their middle). */
const WEST_STREET_X = -31.5;
const EAST_STREET_X = 28.5;
export const AVENUE_Z = 36;
export const AVENUE_WALK_NORTH = AVENUE_Z - AVENUE.width / 2 - AVENUE.sidewalk;
/** Front line of the houses on the avenue's south side. */
export const AVENUE_LOT_START = AVENUE_Z + AVENUE.width / 2 + AVENUE.sidewalk + 0.5;

const MAIN: Road = {
  axis: 'x',
  at: 0,
  from: -50,
  to: 50,
  width: ROAD_WIDTH,
  sidewalk: SIDEWALK,
};
const NORTH: Road = { axis: 'z', at: 0, from: -50, to: 0, width: ROAD_WIDTH, sidewalk: SIDEWALK };
const AVENUE_ROAD: Road = { axis: 'x', at: AVENUE_Z, from: -36, to: 36, ...AVENUE };
const WEST: Road = { axis: 'z', at: WEST_STREET_X, from: 0, to: AVENUE_Z, width: 5, sidewalk: 1.5 };
const EAST: Road = { axis: 'z', at: EAST_STREET_X, from: 0, to: AVENUE_Z, width: 5, sidewalk: 1.5 };

export const ROADS: readonly Road[] = [MAIN, NORTH, AVENUE_ROAD, WEST, EAST];

/** Every painted crossing in town. Only the one by the market has a traffic light. */
export const CROSSINGS: readonly Crossing[] = [
  { road: MAIN, at: CROSSWALK_X, width: CROSSWALK_WIDTH, signal: true },
  { road: MAIN, at: HOME_CROSSWALK_X, width: CROSSWALK_WIDTH },
  { road: NORTH, at: -9, width: 4 },
  { road: AVENUE_ROAD, at: -13, width: 3.6 },
  { road: AVENUE_ROAD, at: 13, width: 3.6 },
  { road: WEST, at: 15, width: 3.2 },
  { road: EAST, at: 15, width: 3.2 },
];

/** Cars drive on the right, clockwise around the blocks south of the main street. */
const LANE = 1.75;
const SIDE_LANE = 1.25;
export const CAR_LOOP: readonly Point[] = [
  { x: -27, z: LANE },
  { x: 24, z: LANE },
  { x: 26.5, z: 2.7 },
  { x: EAST_STREET_X - SIDE_LANE, z: 5 },
  { x: EAST_STREET_X - SIDE_LANE, z: 31 },
  { x: 26.5, z: 33.5 },
  { x: 24, z: AVENUE_Z - 1.5 },
  { x: -27, z: AVENUE_Z - 1.5 },
  { x: -29.3, z: 33.5 },
  { x: WEST_STREET_X + SIDE_LANE, z: 31 },
  { x: WEST_STREET_X + SIDE_LANE, z: 5 },
  { x: -29.3, z: 2.7 },
];

/**
 * Street furniture stays on the outer edge of the sidewalk, or off it, so the
 * middle is a free corridor. Each collider is the size of what is drawn.
 */
const LAMP_RADIUS = 0.3;
const POST_RADIUS = 0.15;
const TREE_RADIUS = 0.45;
const EDGE = ROAD_WIDTH / 2 + SIDEWALK;
const LAMP_LINE = EDGE - 0.3;
/** Just behind the avenue's narrow sidewalk, which has no room to spare. */
const AVENUE_LAMP_LINE = AVENUE_Z + AVENUE.width / 2 + AVENUE.sidewalk + 0.3;

const BUS_STOP_X = -12;
export const BUS_STOP = {
  x: BUS_STOP_X,
  /** The shelter, behind the sidewalk. */
  shelterZ: -(EDGE + 1.05),
  /** The sign, at the curb where the bus stops. */
  signZ: -(ROAD_WIDTH / 2 + 0.25),
  /** Where the child waits. */
  waitZ: -(ROAD_WIDTH / 2 + 0.9),
  /** The lane the bus comes along, close to the curb. */
  lane: -1.9,
} as const;

const mainLamps: readonly Point[] = [-44, -24, -14, 4, 22, 44].flatMap((x) =>
  [-1, 1].flatMap((side) =>
    side === -1 && Math.abs(x - BUS_STOP_X) < 4 ? [] : [{ x, z: side * LAMP_LINE }],
  ),
);

export const lamps: readonly Point[] = [
  ...mainLamps,
  ...[-32.5, -19.5, -6.5, 6.5, 19.5, 32.5].map((x) => ({ x, z: AVENUE_LAMP_LINE })),
];

export const streetTrees: readonly Point[] = [
  { x: -14, z: 9 },
  { x: 30, z: -9 },
  { x: -6, z: -20 },
  { x: 6, z: -30 },
  { x: -6, z: -40 },
];

export const avenueTrees: readonly Point[] = [
  { x: -19.5, z: AVENUE_WALK_NORTH - 0.6 },
  { x: 19.5, z: AVENUE_WALK_NORTH - 0.6 },
  { x: -23, z: 21 },
  { x: -14, z: 28 },
  { x: 20, z: 30 },
];

export const trafficLights: readonly Point[] = [
  { x: CROSSWALK_X - CROSSWALK_WIDTH / 2 - 0.9, z: -4.2 },
  { x: CROSSWALK_X - CROSSWALK_WIDTH / 2 - 0.9, z: 4.2 },
];

/** Short signs by the child's gate: everything starts from there. */
export const WAY_SIGN = { x: -19, z: LAMP_LINE } as const;

/** What stands on or beside the sidewalks: the same list the game collides with. */
export const furnitureColliders: readonly Collider[] = [
  ...lamps.map(({ x, z }) => circle(x, z, LAMP_RADIUS)),
  ...[...streetTrees, ...avenueTrees].map(({ x, z }) => circle(x, z, TREE_RADIUS)),
  ...trafficLights.map(({ x, z }) => circle(x, z, LAMP_RADIUS)),
  circle(BUS_STOP.x + 2.9, BUS_STOP.signZ, POST_RADIUS),
  circle(WAY_SIGN.x, WAY_SIGN.z, POST_RADIUS),
  // Back of the shelter and its bench; the roof stands above everybody.
  box(BUS_STOP.x, BUS_STOP.shelterZ - 0.66, 3.7, 0.12),
  box(BUS_STOP.x, BUS_STOP.shelterZ - 0.25, 2.3, 0.7),
];

/** The way from the child's door to the bus stop, on the crosswalk. */
export const doorToBusStop = (door: Point): readonly Point[] => [
  door,
  { x: HOME_CROSSWALK_X, z: ROAD_WIDTH / 2 + 0.6 },
  { x: HOME_CROSSWALK_X, z: -(ROAD_WIDTH / 2 + 0.6) },
  { x: BUS_STOP.x, z: BUS_STOP.waitZ },
];
