import type { MissionId } from '@domain/mission/mission';

export type WorldId = 'city' | 'nature' | 'school' | 'emotions';

export interface World {
  readonly id: WorldId;
  readonly name: string;
  readonly missionIds: readonly MissionId[];
  /** Hex color (0xRRGGBB) for the placeholder map art. */
  readonly color: number;
}
