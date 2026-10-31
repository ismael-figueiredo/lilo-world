export interface Pigeon {
  /** Height above the ground. */
  readonly height: number;
  /** Seconds left in the air. */
  readonly away: number;
}

export const pigeonOnTheGround: Pigeon = { height: 0, away: 0 };

/** Closer than this, the pigeon takes off. */
export const SCARE_RANGE = 3.2;
const TIME_AWAY = 7;
const FLIGHT_HEIGHT = 5;
const CLIMB = 3.5;
const LAND = 1.6;

/** Takes off when the child comes close and lands again, always in the same calm way. */
export function stepPigeon(pigeon: Pigeon, childDistance: number, dt: number): Pigeon {
  const scared = childDistance < SCARE_RANGE;
  const away = scared ? TIME_AWAY : Math.max(0, pigeon.away - dt);
  const height =
    away > 0
      ? Math.min(FLIGHT_HEIGHT, pigeon.height + CLIMB * dt)
      : Math.max(0, pigeon.height - LAND * dt);
  return { height, away };
}
