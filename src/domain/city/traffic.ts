import { firstInTheWay, wrap, type Point, type Route } from '@domain/city/route';

export interface Car {
  /** Where the middle of the car is, along the route. */
  readonly distance: number;
  readonly speed: number;
}

/** A place where cars may have to stop: a traffic light or a crosswalk. */
export interface StopLine {
  readonly at: number;
  readonly closed: boolean;
  /** Yellow: a car too close to stop calmly goes on. People never get this. */
  readonly lateCarsPass?: boolean;
}

export interface Road {
  readonly route: Route;
  readonly lines: readonly StopLine[];
  /** People who may be on the road. */
  readonly people: readonly Point[];
  /** Where the other cars are. */
  readonly others: readonly number[];
}

/** Slow on purpose: a calm town, where everything can be followed with the eyes. */
export const CRUISE = 4.5;
const SPEED_UP = 1.6;
const CALM_BRAKE = 3;
const HARD_BRAKE = 6;
/** From the middle of a car to its nose, and a little air. */
export const NOSE = 2.4;
const CAR_GAP = 6.2;
const LOOK_AHEAD = 14;
/** The car stops this far from anybody. */
const PERSON_SPACE = 1.2;
const PERSON_REACH = 9;
/** Half a car and a person. */
const LANE_HALF = 1.5;

const stoppingDistance = (speed: number, brake: number): number => (speed * speed) / (2 * brake);

function roomAhead(car: Car, { route, lines, people, others }: Road): number {
  const ahead = (at: number): number => wrap(route, at - car.distance);
  let room = Infinity;
  for (const line of lines) {
    const toLine = ahead(line.at);
    if (!line.closed || toLine > LOOK_AHEAD) continue;
    const free = toLine - NOSE;
    const late = free < stoppingDistance(car.speed, HARD_BRAKE);
    if (line.lateCarsPass !== true || !late) room = Math.min(room, free);
  }
  for (const other of others) {
    const toOther = ahead(other);
    if (toOther < LOOK_AHEAD) room = Math.min(room, toOther - CAR_GAP);
  }
  for (const person of people) {
    const toPerson = firstInTheWay(route, car.distance, person, PERSON_REACH, LANE_HALF);
    if (toPerson !== undefined) room = Math.min(room, toPerson - NOSE - PERSON_SPACE);
  }
  return Math.max(0, room);
}

/**
 * One moment of a car: it speeds up gently and always has room to stop. With
 * somebody in the way it stops at once, because here nobody can get hurt.
 */
export function stepCar(car: Car, road: Road, dt: number): Car {
  const room = roomAhead(car, road);
  const safe = Math.sqrt(2 * CALM_BRAKE * room);
  const speed = Math.min(car.speed + SPEED_UP * dt, CRUISE, safe, room / dt);
  return { distance: wrap(road.route, car.distance + speed * dt), speed };
}
