import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { MissionStats } from '@domain/progress/player-progress';
import { isWorldUnlocked } from '@domain/world/world';

export interface MissionSummary {
  readonly id: string;
  readonly title: string;
  readonly worldName: string;
  readonly done: boolean;
  readonly stats: MissionStats;
}

export interface ProgressSummary {
  readonly coins: number;
  readonly stars: number;
  readonly itemsOwned: number;
  readonly itemsTotal: number;
  readonly worldsOpen: number;
  readonly worldsTotal: number;
  readonly missions: readonly MissionSummary[];
}

export class GetProgressSummary {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly progress: ProgressRepository,
  ) {}

  async execute(): Promise<ProgressSummary> {
    const [worlds, items, progress] = await Promise.all([
      this.catalog.listWorlds(),
      this.catalog.listWardrobeItems(),
      this.progress.load(),
    ]);

    const missions: MissionSummary[] = [];
    for (const world of worlds) {
      for (const id of world.missionIds) {
        const mission = await this.catalog.findMission(id);
        if (mission === undefined) continue;
        missions.push({
          id,
          title: mission.title,
          worldName: world.name,
          done: progress.hasCompleted(id),
          stats: progress.statsFor(id),
        });
      }
    }

    return {
      coins: progress.coins.amount,
      stars: progress.stars,
      itemsOwned: items.filter((item) => progress.owns(item.id)).length,
      itemsTotal: items.length,
      worldsOpen: worlds.filter((world) => isWorldUnlocked(world, progress.stars)).length,
      worldsTotal: worlds.length,
      missions,
    };
  }
}
