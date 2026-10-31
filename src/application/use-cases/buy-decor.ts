import type { ProgressRepository } from '@application/ports/progress-repository';
import { decorOf, type DecorId } from '@domain/reward/room-decor';

/** Spends golden coins on something for the child's room. */
export class BuyDecor {
  constructor(private readonly progress: ProgressRepository) {}

  async owned(): Promise<readonly DecorId[]> {
    return (await this.progress.load()).decor;
  }

  /** False when there are not enough coins yet. */
  async execute(id: DecorId): Promise<boolean> {
    const progress = await this.progress.load();
    const bought = progress.buyDecor(id, decorOf(id).price);
    if (bought === undefined) return false;
    await this.progress.save(bought);
    return true;
  }
}
