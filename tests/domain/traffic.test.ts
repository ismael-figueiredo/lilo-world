import { describe, expect, it } from 'vitest';
import { firstInTheWay, makeRoute, positionAt, wrap, distanceAlong } from '@domain/city/route';
import { CRUISE, NOSE, stepCar, type Car, type Road, type StopLine } from '@domain/city/traffic';
import { trafficPhase } from '@domain/city/traffic-light';
import { pigeonOnTheGround, SCARE_RANGE, stepPigeon } from '@domain/city/pigeon';
import { startRoutine, stepRoutine } from '@domain/people/routine';

const square = makeRoute([
  { x: 0, z: 0 },
  { x: 100, z: 0 },
  { x: 100, z: 20 },
  { x: 0, z: 20 },
]);

const road = (changes: Partial<Road> = {}): Road => ({
  route: square,
  lines: [],
  people: [],
  others: [],
  ...changes,
});

const DT = 1 / 30;

const drive = (start: Car, seconds: number, world: (time: number) => Road): Car => {
  let car = start;
  for (let t = 0; t < seconds; t += DT) car = stepCar(car, world(t), DT);
  return car;
};

describe('route', () => {
  it('finds the place and the heading at any distance, around the loop', () => {
    expect(positionAt(square, 50)).toMatchObject({ x: 50, z: 0 });
    expect(positionAt(square, 50).heading).toBeCloseTo(Math.PI / 2);
    expect(positionAt(square, 110)).toMatchObject({ x: 100, z: 10 });
    expect(positionAt(square, square.length + 50).x).toBeCloseTo(50);
    expect(wrap(square, -10)).toBe(square.length - 10);
  });

  it('knows how far along a point is, and if it stands in the way', () => {
    expect(distanceAlong(square, { x: 30, z: 1 })).toBe(30);
    expect(firstInTheWay(square, 10, { x: 15, z: 1 }, 9, 1.5)).toBe(4);
    expect(firstInTheWay(square, 10, { x: 15, z: 3 }, 9, 1.5)).toBeUndefined();
    expect(firstInTheWay(square, 10, { x: 40, z: 0 }, 9, 1.5)).toBeUndefined();
  });
});

describe('cars', () => {
  it('reach a calm speed and stay in it', () => {
    expect(drive({ distance: 0, speed: 0 }, 6, () => road()).speed).toBeCloseTo(CRUISE);
  });

  it('stop before a closed line and go when it opens', () => {
    const line = (closed: boolean): StopLine => ({ at: 40, closed });
    const stopped = drive({ distance: 0, speed: CRUISE }, 20, () => road({ lines: [line(true)] }));
    expect(stopped.speed).toBeCloseTo(0, 1);
    expect(stopped.distance + NOSE).toBeLessThan(40.01);
    const gone = drive(stopped, 6, () => road({ lines: [line(false)] }));
    expect(gone.distance).toBeGreaterThan(40);
  });

  it('never moves on a red light, wherever it was when the cycle began', () => {
    for (let start = 0; start < 80; start += 1.7) {
      let car: Car = { distance: start, speed: CRUISE };
      for (let t = 0; t < 34; t += DT) {
        const phase = trafficPhase(t);
        const line: StopLine = {
          at: 85,
          closed: phase.cars !== 'green',
          ...(phase.cars === 'yellow' ? { lateCarsPass: true } : {}),
        };
        const before = car.distance;
        car = stepCar(car, road({ lines: [line] }), DT);
        const entered = before + NOSE <= 85.01 && car.distance + NOSE > 85.01;
        if (entered) expect(phase.walk, `from ${start} at ${t}`).toBe(false);
      }
      expect(car.distance).toBeGreaterThan(85);
    }
  });

  it('never reaches a person who steps in front of it, however late', () => {
    for (let ahead = 2.6; ahead < 12; ahead += 0.3) {
      let car: Car = { distance: 10, speed: CRUISE };
      const person = { x: 10 + ahead, z: 0.5 };
      for (let t = 0; t < 8; t += DT) {
        car = stepCar(car, road({ people: [person] }), DT);
        expect(person.x - car.distance).toBeGreaterThan(NOSE);
      }
    }
  });

  it('keep their distance from each other, also when the first one stops', () => {
    const line: StopLine = { at: 60, closed: true };
    let first: Car = { distance: 30, speed: CRUISE };
    let second: Car = { distance: 18, speed: CRUISE };
    for (let t = 0; t < 30; t += DT) {
      first = stepCar(first, road({ lines: [line], others: [second.distance] }), DT);
      second = stepCar(second, road({ lines: [line], others: [first.distance] }), DT);
      expect(first.distance - second.distance).toBeGreaterThan(4.6);
    }
  });
});

describe('pigeons', () => {
  it('fly from the child who comes close and land again', () => {
    const up = stepPigeon(pigeonOnTheGround, SCARE_RANGE - 1, 0.5);
    expect(up.height).toBeGreaterThan(0);
    let pigeon = up;
    for (let t = 0; t < 16; t += 0.1) pigeon = stepPigeon(pigeon, 20, 0.1);
    expect(pigeon.height).toBe(0);
  });
});

describe('people at the curb', () => {
  const route = [
    { x: 0, z: 0, curb: true },
    { x: 0, z: 8, curb: true },
  ];
  const far = { x: 50, z: 50 };

  it('wait until they may cross', () => {
    const step = stepRoutine(startRoutine, route, { x: 0, z: 0 }, far, 0.1, () => false);
    expect(step.walk).toEqual({ x: 0, z: 0 });
    const go = stepRoutine(startRoutine, route, { x: 0, z: 0 }, far, 0.1, () => true);
    expect(go.walk.z).toBe(1);
  });

  it('do not stop in the middle of the street, not even for the child', () => {
    const step = stepRoutine(startRoutine, route, { x: 0, z: 4 }, { x: 1, z: 4 }, 0.1, () => false);
    expect(step.walk.z).toBe(1);
  });
});
