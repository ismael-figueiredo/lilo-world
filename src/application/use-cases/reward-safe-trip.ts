import type { ProgressRepository } from '@application/ports/progress-repository';

/** Coins for reaching a place after crossing only where it is safe. */
export const SAFE_TRIP_COINS = 2;

export class RewardSafeTrip {
  constructor(private readonly progress: ProgressRepository) {}

  async execute(): Promise<number> {
    const current = await this.progress.load();
    await this.progress.save(current.earnCoins(SAFE_TRIP_COINS));
    return SAFE_TRIP_COINS;
  }
}
