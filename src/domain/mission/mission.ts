import type { Reward } from '@domain/reward/reward';
import type { WorldId } from '@domain/world/world';

export type MissionId = string;

/** Something the child can see and touch in a mission (a fruit on a shelf, a bus button...). */
export interface MissionChoice {
  readonly id: string;
  readonly label: string;
  /** Provisional pictogram (emoji) until ARASAAC pictograms are added. */
  readonly pictogram: string;
}

/** One instruction at a time: the mascot asks for a single target. */
export interface MissionStep {
  readonly targetId: string;
  readonly prompt: string;
}

export interface Mission {
  readonly id: MissionId;
  readonly worldId: WorldId;
  readonly title: string;
  readonly introduction: string;
  readonly choices: readonly MissionChoice[];
  readonly steps: readonly MissionStep[];
  readonly reward: Reward;
}
