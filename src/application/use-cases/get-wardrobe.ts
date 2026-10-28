import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { WardrobeItem } from '@domain/avatar/wardrobe-item';

export interface WardrobeEntry {
  readonly item: WardrobeItem;
  readonly owned: boolean;
  readonly equipped: boolean;
  readonly affordable: boolean;
}

export interface Wardrobe {
  readonly coins: number;
  readonly entries: readonly WardrobeEntry[];
}

export class GetWardrobe {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly progress: ProgressRepository,
  ) {}

  async execute(): Promise<Wardrobe> {
    const [items, progress] = await Promise.all([
      this.catalog.listWardrobeItems(),
      this.progress.load(),
    ]);
    return {
      coins: progress.coins.amount,
      entries: items.map((item) => ({
        item,
        owned: progress.owns(item.id),
        equipped: progress.equipped[item.slot] === item.id,
        affordable: progress.coins.amount >= item.price,
      })),
    };
  }
}
