import { describe, expect, it } from 'vitest';
import { BOARD_SQUARES, boardAfter, dieRoll, playsInside } from '@domain/play/games';

describe('games for rainy days', () => {
  it('keeps everybody in only when it rains', () => {
    expect(playsInside('rain')).toBe(true);
    expect(playsInside('sunny')).toBe(false);
    expect(playsInside('cold')).toBe(false);
  });

  it('rolls small numbers', () => {
    for (let turn = 0; turn < 12; turn += 1) {
      const roll = dieRoll(turn, 3);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(3);
    }
  });

  it('never goes past the last square', () => {
    expect(boardAfter(2, 3)).toBe(5);
    expect(boardAfter(BOARD_SQUARES - 2, 3)).toBe(BOARD_SQUARES - 1);
  });
});
