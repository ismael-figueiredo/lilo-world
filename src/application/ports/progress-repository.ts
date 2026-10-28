import type { PlayerProgress } from '@domain/progress/player-progress';

/** Where the child's progress lives. By design it stays on the device: no accounts, no servers. */
export interface ProgressRepository {
  load(): Promise<PlayerProgress>;
  save(progress: PlayerProgress): Promise<void>;
}
