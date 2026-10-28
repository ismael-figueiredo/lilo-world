import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProgressRepository } from '@application/ports/progress-repository';
import { isWorldUnlocked, type World } from '@domain/world/world';

export interface WorldMapEntry {
  readonly world: World;
  readonly unlocked: boolean;
  /** Stars still missing to open the world (0 when unlocked). */
  readonly starsMissing: number;
}

export interface WorldMap {
  readonly stars: number;
  readonly worlds: readonly WorldMapEntry[];
}

export class GetWorldMap {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly progress: ProgressRepository,
  ) {}

  async execute(): Promise<WorldMap> {
    const [worlds, progress] = await Promise.all([this.catalog.listWorlds(), this.progress.load()]);
    return {
      stars: progress.stars,
      worlds: worlds.map((world) => ({
        world,
        unlocked: isWorldUnlocked(world, progress.stars),
        starsMissing: Math.max(0, world.requiredStars - progress.stars),
      })),
    };
  }
}
