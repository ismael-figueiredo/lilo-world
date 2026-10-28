export type CarLight = 'green' | 'yellow' | 'red';

export interface TrafficPhase {
  readonly cars: CarLight;
  /** The walking figure is green: people may cross. */
  readonly walk: boolean;
  /** Seconds until the light changes (to show a calm countdown, if wanted). */
  readonly secondsLeft: number;
}

/**
 * One calm cycle shared by every traffic light in town: long green for cars,
 * short yellow, then red for cars while people cross. Pedestrians get green a
 * moment after cars stop, and lose it a moment before cars go.
 */
export const TRAFFIC_CYCLE = {
  carsGreen: 7,
  carsYellow: 2,
  carsRed: 8,
  /** Safety gap between the car light and the walking figure. */
  margin: 0.5,
} as const;

const cycleLength = TRAFFIC_CYCLE.carsGreen + TRAFFIC_CYCLE.carsYellow + TRAFFIC_CYCLE.carsRed;

export function trafficPhase(seconds: number): TrafficPhase {
  const { carsGreen, carsYellow, margin } = TRAFFIC_CYCLE;
  const t = ((seconds % cycleLength) + cycleLength) % cycleLength;
  const redStart = carsGreen + carsYellow;
  if (t < carsGreen) return { cars: 'green', walk: false, secondsLeft: carsGreen - t };
  if (t < redStart) return { cars: 'yellow', walk: false, secondsLeft: redStart - t };
  const walk = t >= redStart + margin && t < cycleLength - margin;
  const secondsLeft = walk
    ? cycleLength - margin - t
    : t < redStart + margin
      ? redStart + margin - t
      : cycleLength - t;
  return { cars: 'red', walk, secondsLeft };
}
