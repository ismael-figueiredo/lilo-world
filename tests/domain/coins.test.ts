import { describe, expect, it } from 'vitest';
import { Coins } from '@domain/reward/coins';

const coins = (amount: number): Coins => {
  const result = Coins.of(amount);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe('Coins', () => {
  it.each([-1, 1.5, Number.NaN])('rejects invalid amount %s', (amount) => {
    const result = Coins.of(amount);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-amount');
  });

  it('adds amounts', () => {
    expect(coins(3).add(coins(4)).amount).toBe(7);
  });

  it('subtracts when there is enough', () => {
    const result = coins(10).subtract(coins(4));
    expect(result.ok && result.value.amount).toBe(6);
  });

  it('refuses to go below zero', () => {
    const result = coins(3).subtract(coins(4));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not-enough-coins');
  });

  it('compares amounts', () => {
    expect(coins(5).isAtLeast(coins(5))).toBe(true);
    expect(coins(4).isAtLeast(coins(5))).toBe(false);
  });
});
