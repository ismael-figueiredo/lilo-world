import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { WardrobeItemId } from '@domain/avatar/wardrobe-item';
import type { PlayerProgress } from '@domain/progress/player-progress';
import { domainError, err, ok, type Result } from '@domain/shared/result';

/** Puts an owned item on, or takes it off when it is already being worn. */
export class ToggleWardrobeItem {
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
    const isWorn = current.equipped[item.slot] === item.id;
    const next = isWorn ? ok(current.unequip(item.slot)) : current.equip(item);
    if (!next.ok) return next;

    await this.progress.save(next.value);
    return next;
  }
}
