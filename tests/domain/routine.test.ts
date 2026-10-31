import { describe, expect, it } from 'vitest';
import { NOTICE_RANGE, startRoutine, stepRoutine, type Routine } from '@domain/people/routine';

const route = [
  { x: 0, z: 0 },
  { x: 10, z: 0 },
  { x: 10, z: 10 },
];
const farAway = { x: 100, z: 100 };

describe('a person of the neighborhood', () => {
  it('walks toward the next stop', () => {
    const step = stepRoutine(startRoutine, route, { x: 0, z: 0 }, farAway, 0.1);
    expect(step.walk).toEqual({ x: 1, z: 0 });
    expect(step.lookAtChild).toBe(false);
  });

  it('rests at a stop, then goes on', () => {
    const arrived = stepRoutine(startRoutine, route, { x: 10, z: 0 }, farAway, 0.1);
    expect(arrived.walk).toEqual({ x: 0, z: 0 });
    expect(arrived.routine.target).toBe(2);

    const resting = stepRoutine(arrived.routine, route, { x: 10, z: 0 }, farAway, 1);
    expect(resting.walk).toEqual({ x: 0, z: 0 });
    const rested = stepRoutine(resting.routine, route, { x: 10, z: 0 }, farAway, 3);
    expect(rested.walk).toEqual({ x: 0, z: 1 });
  });

  it('turns back at both ends of the route', () => {
    const atEnd: Routine = { ...startRoutine, target: 2 };
    const back = stepRoutine(atEnd, route, { x: 10, z: 10 }, farAway, 0.1).routine;
    expect(back).toMatchObject({ target: 1, returning: true });

    const atStart: Routine = { ...startRoutine, target: 0, returning: true };
    const again = stepRoutine(atStart, route, { x: 0, z: 0 }, farAway, 0.1).routine;
    expect(again).toMatchObject({ target: 1, returning: false });
  });

  it('stops and waves once when the child comes near', () => {
    const near = { x: NOTICE_RANGE - 1, z: 0 };
    const first = stepRoutine(startRoutine, route, { x: 0, z: 0 }, near, 0.1);
    expect(first.walk).toEqual({ x: 0, z: 0 });
    expect(first).toMatchObject({ lookAtChild: true, wave: true });

    const second = stepRoutine(first.routine, route, { x: 0, z: 0 }, near, 0.1);
    expect(second).toMatchObject({ lookAtChild: true, wave: false });
  });

  it('greets again only after a while', () => {
    const near = { x: 1, z: 0 };
    const greeted = stepRoutine(startRoutine, route, { x: 0, z: 0 }, near, 0).routine;
    expect(stepRoutine(greeted, route, { x: 0, z: 0 }, near, 26).wave).toBe(true);
  });

  it('stays where it is on a route of one stop', () => {
    const step = stepRoutine(startRoutine, [{ x: 1, z: 1 }], { x: 1, z: 1 }, farAway, 0.1);
    expect(step.walk).toEqual({ x: 0, z: 0 });
  });
});
