import { domainError, err, ok, type Result } from '@domain/shared/result';

/** Non-negative whole amount of in-game coins. There is no real money anywhere in the game. */
export class Coins {
  private constructor(readonly amount: number) {}

  static readonly zero = new Coins(0);

  static of(amount: number): Result<Coins> {
    if (!Number.isInteger(amount) || amount < 0) {
      return err(domainError('invalid-amount', `Coins must be a non-negative integer: ${amount}`));
    }
    return ok(new Coins(amount));
  }

  add(other: Coins): Coins {
    return new Coins(this.amount + other.amount);
  }

  subtract(other: Coins): Result<Coins> {
    if (other.amount > this.amount) {
      return err(domainError('not-enough-coins', 'Not enough coins'));
    }
    return ok(new Coins(this.amount - other.amount));
  }

  isAtLeast(other: Coins): boolean {
    return this.amount >= other.amount;
  }
}
