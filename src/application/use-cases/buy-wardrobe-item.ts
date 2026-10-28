import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { WardrobeItemId } from '@domain/avatar/wardrobe-item';
import type { PlayerProgress } from '@domain/progress/player-progress';
import { domainError, err, type Result } from '@domain/shared/result';

/** Buys an item with in-game coins and puts it on right away, so the reward is immediate. */
export class BuyWardrobeItem {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly progress: ProgressRepository,
  ) {}

  async execute(itemId: WardrobeItemId): Promise<Result<PlayerProgress>> {
    const item = await this.catalog.findWardrobeItem(itemId);
    if (item === undefined) {
      return err(domainError('not-found', `Wardrobe item not found: ${itemId}`));
    }

    const current = await this.progress.load();
    const bought = current.buy(item);
    if (!bought.ok) return bought;

    const equipped = bought.value.equip(item);
    if (!equipped.ok) return equipped;

    await this.progress.save(equipped.value);
    return equipped;
  }
}
