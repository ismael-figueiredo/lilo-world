export interface Spot {
  readonly x: number;
  readonly z: number;
  /** At the curb: walking between two curbs is crossing the street. */
  readonly curb?: boolean;
}

/** How far away someone notices the child, and stops to say hello. */
export const NOTICE_RANGE = 4;
/** Someone who greeted does not greet again for a while: it would become noise. */
const GREET_AGAIN_AFTER = 25;
/** Standing at each end of the route before walking again. */
const PAUSE_AT_STOP = 3;
const REACHED = 0.25;
/** Still at the curb, so not on the street yet. */
const AT_CURB = 0.6;

export interface Routine {
  /** Index of the stop being walked to. */
  readonly target: number;
  /** Walking back along the route. */
  readonly returning: boolean;
  readonly pause: number;
  readonly greetCooldown: number;
}

/** What the person does in this frame. */
export interface RoutineStep {
  readonly routine: Routine;
  /** Direction to walk, with length 1, or still. */
  readonly walk: Spot;
  readonly lookAtChild: boolean;
  readonly wave: boolean;
}

export const startRoutine: Routine = {
  target: 1,
  returning: false,
  pause: 0,
  greetCooldown: 0,
};

const STILL: Spot = { x: 0, z: 0 };

function nextStop(routine: Routine, length: number): Routine {
  const returning =
    routine.target >= length - 1 ? true : routine.target <= 0 ? false : routine.returning;
  return {
    ...routine,
    returning,
    target: routine.target + (returning ? -1 : 1),
    pause: PAUSE_AT_STOP,
  };
}

/**
 * One moment in the life of a person of the neighborhood: walks a route back
 * and forth, rests at each stop, and stops to look at the child who comes near,
 * waving once. At a curb they wait until it is safe, and once they started
 * crossing nothing stops them halfway. A route with one stop is someone who
 * stays there.
 */
export function stepRoutine(
  routine: Routine,
  route: readonly Spot[],
  position: Spot,
  child: Spot,
  dt: number,
  mayCross: (curb: Spot) => boolean = () => true,
): RoutineStep {
  const cooled = {
    ...routine,
    greetCooldown: Math.max(0, routine.greetCooldown - dt),
    pause: Math.max(0, routine.pause - dt),
  };
  const stop = route[cooled.target];
  const from = route[cooled.target + (cooled.returning ? 1 : -1)];
  const crossing = stop?.curb === true && from?.curb === true;
  const started = crossing && Math.hypot(from.x - position.x, from.z - position.z) > AT_CURB;
  if (!started && Math.hypot(child.x - position.x, child.z - position.z) <= NOTICE_RANGE) {
    const wave = cooled.greetCooldown === 0;
    return {
      routine: wave ? { ...cooled, greetCooldown: GREET_AGAIN_AFTER } : cooled,
      walk: STILL,
      lookAtChild: true,
      wave,
    };
  }
  const waiting = crossing && !started && !mayCross(from);
  if (stop === undefined || (cooled.pause > 0 && !started) || waiting) {
    return { routine: cooled, walk: STILL, lookAtChild: false, wave: false };
  }
  const dx = stop.x - position.x;
  const dz = stop.z - position.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= REACHED) {
    return {
      routine: nextStop(cooled, route.length),
      walk: STILL,
      lookAtChild: false,
      wave: false,
    };
  }
  return {
    routine: cooled,
    walk: { x: dx / distance, z: dz / distance },
    lookAtChild: false,
    wave: false,
  };
}
