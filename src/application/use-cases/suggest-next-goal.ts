import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { WardrobeItemId } from '@domain/avatar/wardrobe-item';
import type { MissionId } from '@domain/mission/mission';

export type Goal =
  | { readonly kind: 'mission'; readonly missionId: MissionId; readonly isNew: boolean }
  | { readonly kind: 'wardrobe'; readonly itemId: WardrobeItemId }
  | { readonly kind: 'explore' };

/**
 * One clear next step, so the mascot never gives two instructions at once:
 * a new mission first, then spending coins, then replaying for more coins.
 */
export class SuggestNextGoal {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly progress: ProgressRepository,
  ) {}

  async execute(): Promise<Goal> {
    const [worlds, items, progress] = await Promise.all([
      this.catalog.listWorlds(),
      this.catalog.listWardrobeItems(),
      this.progress.load(),
    ]);

    const missionIds = worlds.flatMap((world) => world.missionIds);

    const newMission = missionIds.find((id) => !progress.hasCompleted(id));
    if (newMission !== undefined) return { kind: 'mission', missionId: newMission, isNew: true };

    const affordable = items
      .filter((item) => item.price > 0 && !progress.owns(item.id))
      .filter((item) => item.price <= progress.coins.amount)
      .sort((a, b) => a.price - b.price)[0];
    if (affordable !== undefined) return { kind: 'wardrobe', itemId: affordable.id };

    const replay = missionIds[0];
    if (replay !== undefined) return { kind: 'mission', missionId: replay, isNew: false };

    return { kind: 'explore' };
  }
}
