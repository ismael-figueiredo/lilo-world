import type { Point } from '@domain/city/route';

/**
 * Games here have no score against anybody and nobody loses: a game ends after
 * a few turns, and everything the child did counts as having played.
 */
export type GameId =
  'basket' | 'soccer' | 'hide' | 'hopscotch' | 'catch' | 'rope' | 'swing' | 'slide' | 'seesaw';

export const TRIES = 5;
export const HOPSCOTCH_SQUARES = 8;
export const CATCHES = 5;
export const ROPE_JUMPS = 5;
export const BOARD_SQUARES = 10;
export const TOWER_BLOCKS = 5;

const DIE_FACES = [2, 1, 3, 2, 3, 1] as const;

/** The die of the board game: each turn is another number, always small, never a surprise. */
export const dieRoll = (turn: number, dayNumber: number): number =>
  DIE_FACES[(turn + dayNumber) % DIE_FACES.length] ?? 1;

/** Moving along the board, without going past the last square. */
export const boardAfter = (square: number, roll: number): number =>
  Math.min(BOARD_SQUARES - 1, square + roll);

/** Rain keeps everybody in: games that need a yard wait for another day. */
export const playsInside = (weather: string): boolean => weather === 'rain';

/** How far from the middle a shot may be, -1 to 1 being the whole bar. */
const FIRST_TOLERANCE = 0.25;
const HELP_PER_MISS = 0.25;

/** Each miss makes the hoop more generous: in five tries, the ball always goes in. */
export const aimTolerance = (misses: number): number => FIRST_TOLERANCE + HELP_PER_MISS * misses;

export const shotHits = (aim: number, misses: number): boolean =>
  Math.abs(aim) <= aimTolerance(misses);

/** Where a thrown ball is at `t`, from 0 to 1. */
export function ballArc(
  from: Point & { readonly y: number },
  to: Point & { readonly y: number },
  height: number,
  t: number,
): Point & { readonly y: number } {
  const blend = Math.min(1, Math.max(0, t));
  return {
    x: from.x + (to.x - from.x) * blend,
    y: from.y + (to.y - from.y) * blend + Math.sin(blend * Math.PI) * height,
    z: from.z + (to.z - from.z) * blend,
  };
}

/** Friends answer in different ways, and a no is an ordinary answer. */
export type InviteAnswer = 'yes' | 'later' | 'no';

const answers: readonly InviteAnswer[] = ['yes', 'later', 'yes', 'no'];

export function inviteAnswer(friend: number, dayNumber: number): InviteAnswer {
  return answers[(friend + dayNumber) % answers.length] ?? 'yes';
}

/** There is always someone to play with: the last friend asked says yes. */
export const inviteOf = (friend: number, dayNumber: number, last: boolean): InviteAnswer =>
  last ? 'yes' : inviteAnswer(friend, dayNumber);

/** Physical education has its own days, and one sport at a time. */
export const isPeDay = (dayNumber: number): boolean => dayNumber % 2 === 0;

export const peSport = (dayNumber: number): 'basket' | 'soccer' =>
  dayNumber % 4 === 0 ? 'soccer' : 'basket';

/** Places to hide stay in plain sight, and each friend hides in a different one. */
export function hidingPlaces<T>(places: readonly T[], friends: number, dayNumber: number): T[] {
  return Array.from({ length: friends }, (_, index) => {
    const place = places[(dayNumber + index) % places.length];
    if (place === undefined) throw new Error('No place to hide');
    return place;
  });
}
