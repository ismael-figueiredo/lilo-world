import type { MissionId } from '@domain/mission/mission';

export type WorldId = 'city' | 'nature' | 'home' | 'school' | 'emotions';

export interface World {
  readonly id: WorldId;
  readonly name: string;
  /** Stars needed before the world opens on the map. */
  readonly requiredStars: number;
  readonly missionIds: readonly MissionId[];
  /** Hex color (0xRRGGBB) for the placeholder map art. */
  readonly color: number;
}

export const isWorldUnlocked = (world: World, stars: number): boolean =>
  stars >= world.requiredStars;
