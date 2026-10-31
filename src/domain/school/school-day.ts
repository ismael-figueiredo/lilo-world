import { isPeDay } from '@domain/play/games';

/**
 * The school's own agenda, always the same: the bus, arriving, the class, asking
 * for what one needs, the snack and going home.
 */
export const schoolStages = [
  'stop',
  'ride',
  'greet',
  'backpack',
  'seat',
  'ask',
  'toilet',
  'snack',
  'pe',
  'recess',
  'leave',
] as const;
export type SchoolStage = (typeof schoolStages)[number];

export const firstSchoolStage: SchoolStage = 'stop';

export const isSchoolStage = (value: unknown): value is SchoolStage =>
  schoolStages.includes(value as SchoolStage);

/** The next stage. The last one stays: leaving school ends the step of the day. */
export function nextSchoolStage(stage: SchoolStage): SchoolStage {
  return schoolStages[schoolStages.indexOf(stage) + 1] ?? stage;
}

/** Asking for something: each need has its answer, and every one of them is right. */
export type Need = 'toilet' | 'help' | 'water';

/** Only the bathroom has somewhere to go; the others are answered right there. */
export const afterAsking = (need: Need): SchoolStage => (need === 'toilet' ? 'toilet' : 'snack');

/** Physical education comes on its days, and recess comes always. */
export const schoolStageAfterSnack = (dayNumber: number): SchoolStage =>
  isPeDay(dayNumber) ? 'pe' : 'recess';

/** Waiting for one's turn: each person served moves the line one place. */
export function lineAfter(ahead: number): number {
  return Math.max(0, ahead - 1);
}
