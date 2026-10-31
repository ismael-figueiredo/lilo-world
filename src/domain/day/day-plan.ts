import { sanitizeErrand, type Errand } from '@domain/errand/errand';
import { isSchoolStage, type SchoolStage } from '@domain/school/school-day';

export type BlockId = 'morning' | 'school' | 'afternoon' | 'night';

export type StepId =
  | 'wake'
  | 'eat'
  | 'teeth'
  | 'dress'
  | 'backpack'
  | 'school'
  | 'lunch'
  | 'study'
  | 'outside'
  | 'shower'
  | 'pajamas'
  | 'sleep';

export interface Block {
  readonly id: BlockId;
  readonly steps: readonly StepId[];
}

/** Every day has the same shape: that is what makes it predictable. */
export const dayBlocks: readonly Block[] = [
  { id: 'morning', steps: ['wake', 'eat', 'teeth', 'dress', 'backpack'] },
  { id: 'school', steps: ['school'] },
  { id: 'afternoon', steps: ['lunch', 'study', 'outside'] },
  { id: 'night', steps: ['shower', 'pajamas', 'sleep'] },
];

export interface DayState {
  /** Starts at 1 and grows when the child sleeps in the game, not with the device's clock. */
  readonly number: number;
  readonly done: readonly StepId[];
  /** Today's lunch task, from the moment the adult asks. */
  readonly errand?: Errand;
  /** Where the child is in the school's own agenda. */
  readonly school?: SchoolStage;
}

export const firstDay: DayState = { number: 1, done: [] };

const allSteps = dayBlocks.flatMap((block) => block.steps);

export const isStep = (value: unknown): value is StepId => allSteps.includes(value as StepId);

/** Returns the first day for missing or broken data: nothing here can stop the game. */
export function sanitizeDay(raw: unknown): DayState {
  if (typeof raw !== 'object' || raw === null) return firstDay;
  const { number, done, errand, school } = raw as Record<string, unknown>;
  const task = sanitizeErrand(errand);
  return {
    number: typeof number === 'number' && Number.isInteger(number) && number > 0 ? number : 1,
    done: Array.isArray(done) ? [...new Set(done.filter(isStep))] : [],
    ...(task === undefined ? {} : { errand: task }),
    ...(isSchoolStage(school) ? { school } : {}),
  };
}

/** The block the child is in: the first one with something left to do. */
export function currentBlock(day: DayState): Block | undefined {
  return dayBlocks.find((block) => block.steps.some((step) => !day.done.includes(step)));
}

export function currentStep(day: DayState): StepId | undefined {
  return currentBlock(day)?.steps.find((step) => !day.done.includes(step));
}

/** What comes after the current step, for "now → next" boards. */
export function nextStep(day: DayState): StepId | undefined {
  const pending = allSteps.filter((step) => !day.done.includes(step));
  return pending[1];
}

export interface StepResult {
  readonly day: DayState;
  /** True only when this step was counted now. */
  readonly counted: boolean;
  /** A block ended: a natural place to stop and save. */
  readonly blockEnded: boolean;
  readonly dayEnded: boolean;
}

/**
 * Inside a block the child may change the order of things. Steps of later
 * blocks do not count yet, and the same step never counts twice. Sleeping is
 * what starts the next day.
 */
export function completeStep(day: DayState, step: StepId): StepResult {
  const block = currentBlock(day);
  const open = block?.steps.includes(step) === true && !day.done.includes(step);
  if (!open) return { day, counted: false, blockEnded: false, dayEnded: false };
  const done = [...day.done, step];
  if (step === 'sleep') {
    return {
      day: { number: day.number + 1, done: [] },
      counted: true,
      blockEnded: true,
      dayEnded: true,
    };
  }
  // With lunch eaten, the task is over: its list leaves the agenda.
  const { number, errand } = day;
  // Leaving school ends its agenda too.
  const school = step === 'school' ? undefined : day.school;
  return {
    day: {
      number,
      done,
      ...(step === 'lunch' || errand === undefined ? {} : { errand }),
      ...(school === undefined ? {} : { school }),
    },
    counted: true,
    blockEnded: block.steps.every((candidate) => done.includes(candidate)),
    dayEnded: false,
  };
}

/** An adult can jump over a block, for a child who wants to go on. */
export function skipBlock(day: DayState): DayState {
  const block = currentBlock(day);
  if (block === undefined || block.id === 'night') return day;
  return { number: day.number, done: [...new Set([...day.done, ...block.steps])] };
}

export type SchoolThing = 'notebook' | 'pencil' | 'book' | 'lunchbox' | 'sneakers' | 'paints';

/** What every school day needs, and what changes from one day to the next. */
const always: readonly SchoolThing[] = ['notebook', 'pencil'];
const changing: readonly SchoolThing[] = ['book', 'sneakers', 'paints', 'lunchbox'];

/** Today's list for the backpack: it follows the day, so it is never a surprise twice. */
export function backpackList(day: DayState): readonly SchoolThing[] {
  const today = changing[(day.number - 1) % changing.length];
  return today === undefined ? always : [...always, today];
}

/** Things left on the desk that do not go to school today. */
export function notForToday(day: DayState): readonly SchoolThing[] {
  const list = backpackList(day);
  return changing.filter((thing) => !list.includes(thing)).slice(0, 2);
}
