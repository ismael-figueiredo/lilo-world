import { describe, expect, it } from 'vitest';
import {
  backpackList,
  completeStep,
  currentBlock,
  currentStep,
  dayBlocks,
  firstDay,
  nextStep,
  notForToday,
  sanitizeDay,
  skipBlock,
  type DayState,
  type StepId,
} from '@domain/day/day-plan';

const after = (...steps: readonly StepId[]): DayState =>
  steps.reduce((day, step) => completeStep(day, step).day, firstDay);

describe('the day', () => {
  it('starts by waking up, with what comes next already known', () => {
    expect(currentStep(firstDay)).toBe('wake');
    expect(nextStep(firstDay)).toBe('eat');
    expect(currentBlock(firstDay)?.id).toBe('morning');
  });

  it('goes on from the step where it stopped', () => {
    expect(currentStep(after('wake', 'eat'))).toBe('teeth');
  });

  it('lets the child change the order inside a block', () => {
    const result = completeStep(after('wake'), 'dress');
    expect(result.counted).toBe(true);
    expect(currentStep(result.day)).toBe('eat');
  });

  it('does not count a later block or the same step twice', () => {
    expect(completeStep(firstDay, 'sleep').counted).toBe(false);
    expect(completeStep(after('wake'), 'wake').counted).toBe(false);
  });

  it('marks the end of a block as a place to stop', () => {
    const morning = dayBlocks[0]?.steps ?? [];
    const almost = after(...morning.slice(0, -1));
    const last = morning.at(-1)!;
    expect(completeStep(almost, last).blockEnded).toBe(true);
    expect(completeStep(firstDay, 'wake').blockEnded).toBe(false);
    expect(currentBlock(completeStep(almost, last).day)?.id).toBe('afternoon');
  });

  it('starts the next day when the child sleeps', () => {
    const steps = dayBlocks.flatMap((block) => block.steps);
    const evening = after(...steps.slice(0, -1));
    const slept = completeStep(evening, 'sleep');
    expect(slept).toMatchObject({ dayEnded: true, blockEnded: true });
    expect(slept.day).toEqual({ number: 2, done: [] });
  });

  it('lets an adult jump over a block, but not over sleeping', () => {
    expect(currentBlock(skipBlock(firstDay))?.id).toBe('afternoon');
    const night = skipBlock(skipBlock(firstDay));
    expect(currentBlock(night)?.id).toBe('night');
    expect(skipBlock(night)).toEqual(night);
  });

  it('survives broken saves', () => {
    expect(sanitizeDay(undefined)).toEqual(firstDay);
    expect(sanitizeDay({ number: -2, done: 'x' })).toEqual(firstDay);
    expect(sanitizeDay({ number: 3, done: ['wake', 'ghost', 'wake'] })).toEqual({
      number: 3,
      done: ['wake'],
    });
  });
});

describe('the backpack', () => {
  it('always has the basics and one thing that changes with the day', () => {
    const monday = backpackList({ number: 1, done: [] });
    const tuesday = backpackList({ number: 2, done: [] });
    expect(monday).toEqual(expect.arrayContaining(['notebook', 'pencil']));
    expect(monday).not.toEqual(tuesday);
    expect(backpackList({ number: 5, done: [] })).toEqual(monday);
  });

  it('leaves on the desk only what is not needed today', () => {
    const day = { number: 2, done: [] };
    for (const thing of notForToday(day)) expect(backpackList(day)).not.toContain(thing);
    expect(notForToday(day)).toHaveLength(2);
  });
});
