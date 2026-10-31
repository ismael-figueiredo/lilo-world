import { describe, expect, it } from 'vitest';
import {
  aimTolerance,
  ballArc,
  hidingPlaces,
  inviteAnswer,
  inviteOf,
  isPeDay,
  peSport,
  shotHits,
  TRIES,
} from '@domain/play/games';
import { afterAsking, nextSchoolStage, schoolStageAfterSnack } from '@domain/school/school-day';

describe('basketball', () => {
  it('always goes in within five tries, however bad the aim', () => {
    let misses = 0;
    for (let turn = 0; turn < TRIES; turn += 1) {
      if (shotHits(1, misses)) break;
      misses += 1;
    }
    expect(misses).toBeLessThan(TRIES);
  });

  it('asks for real aim at first', () => {
    expect(shotHits(0.1, 0)).toBe(true);
    expect(shotHits(0.6, 0)).toBe(false);
    expect(aimTolerance(1)).toBeGreaterThan(aimTolerance(0));
  });
});

describe('a thrown ball', () => {
  const from = { x: 0, y: 1, z: 0 };
  const to = { x: 4, y: 3, z: 0 };

  it('starts in the hand, ends at the target and goes up on the way', () => {
    expect(ballArc(from, to, 2, 0)).toEqual(from);
    expect(ballArc(from, to, 2, 1).x).toBeCloseTo(4);
    expect(ballArc(from, to, 2, 1).y).toBeCloseTo(3);
    expect(ballArc(from, to, 2, 0.5).y).toBeCloseTo(4);
    expect(ballArc(from, to, 2, 2).x).toBeCloseTo(4);
  });
});

describe('friends', () => {
  it('answer in different ways', () => {
    const all = new Set([0, 1, 2, 3].map((friend) => inviteAnswer(friend, 0)));
    expect(all).toEqual(new Set(['yes', 'later', 'no']));
  });

  it('always leave someone to play with', () => {
    for (let day = 0; day < 20; day += 1) expect(inviteOf(2, day, true)).toBe('yes');
  });

  it('hide in different places, always the same way on the same day', () => {
    const spots = hidingPlaces(['a', 'b', 'c', 'd'], 3, 5);
    expect(new Set(spots).size).toBe(3);
    expect(hidingPlaces(['a', 'b', 'c', 'd'], 3, 5)).toEqual(spots);
  });
});

describe('the school agenda with play', () => {
  it('has physical education on some days, one sport at a time', () => {
    expect(isPeDay(2)).toBe(true);
    expect(isPeDay(3)).toBe(false);
    expect(new Set([2, 4].map(peSport))).toEqual(new Set(['basket', 'soccer']));
    expect(schoolStageAfterSnack(2)).toBe('pe');
    expect(schoolStageAfterSnack(3)).toBe('recess');
  });

  it('always goes through recess before leaving', () => {
    expect(nextSchoolStage('pe')).toBe('recess');
    expect(nextSchoolStage('recess')).toBe('leave');
    expect(afterAsking('water')).toBe('snack');
  });
});
