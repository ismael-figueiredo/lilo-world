export type BusState = 'coming' | 'stopped' | 'leaving' | 'gone';

export interface Bus {
  readonly state: BusState;
  /** Along the street: the bus drives toward smaller x. */
  readonly x: number;
  readonly speed: number;
}

export const BUS_START = 56;
const CRUISE = 7;
const BRAKE = 2.4;
const SPEED_UP = 1.5;
const BUS_END = -58;

export const busComing: Bus = { state: 'coming', x: BUS_START, speed: CRUISE };

/**
 * One moment of the bus: it comes down the street, brakes gently to stop exactly
 * at the sign, and waits there, as long as it takes, until it is told to leave.
 */
export function stepBus(bus: Bus, stopAt: number, mayLeave: boolean, dt: number): Bus {
  switch (bus.state) {
    case 'coming': {
      const room = Math.max(0, bus.x - stopAt);
      const speed = Math.min(CRUISE, Math.sqrt(2 * BRAKE * room));
      const x = Math.max(stopAt, bus.x - speed * dt);
      const arrived = x - stopAt < 0.02;
      return arrived ? { state: 'stopped', x: stopAt, speed: 0 } : { ...bus, x, speed };
    }
    case 'stopped':
      return mayLeave ? { ...bus, state: 'leaving' } : bus;
    case 'leaving': {
      const speed = Math.min(CRUISE, bus.speed + SPEED_UP * dt);
      const x = bus.x - speed * dt;
      return x <= BUS_END ? { state: 'gone', x, speed: 0 } : { ...bus, x, speed };
    }
    case 'gone':
      return bus;
  }
}

/** The trip takes 20 to 40 seconds, or a few for an adult who chose short trips. */
export const RIDE_SECONDS = 26;
export const SHORT_RIDE_SECONDS = 4;

export const rideSeconds = (short: boolean): number => (short ? SHORT_RIDE_SECONDS : RIDE_SECONDS);
