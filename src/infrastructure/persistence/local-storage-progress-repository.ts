import type { ProgressRepository } from '@application/ports/progress-repository';
import { PlayerProgress, type ProgressSnapshot } from '@domain/progress/player-progress';

export const PROGRESS_STORAGE_KEY = 'lilo-world:progress:v1';

/**
 * Stores progress in the browser of this device only. Storage can be missing or
 * blocked (private mode, full quota), so every failure falls back to a fresh start.
 */
export class LocalStorageProgressRepository implements ProgressRepository {
  constructor(
    private readonly storage: Storage | undefined,
    private readonly key: string = PROGRESS_STORAGE_KEY,
  ) {}

  load(): Promise<PlayerProgress> {
    try {
      const raw = this.storage?.getItem(this.key);
      if (raw === null || raw === undefined) return Promise.resolve(PlayerProgress.createNew());
      return Promise.resolve(PlayerProgress.fromSnapshot(parseSnapshot(raw)));
    } catch {
      return Promise.resolve(PlayerProgress.createNew());
    }
  }

  save(progress: PlayerProgress): Promise<void> {
    try {
      this.storage?.setItem(this.key, JSON.stringify(progress.toSnapshot()));
    } catch (error) {
      console.warn('Could not save progress', error);
    }
    return Promise.resolve();
  }
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isRecordOfStrings = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === 'string');

function parseSnapshot(raw: string): ProgressSnapshot {
  const data = JSON.parse(raw) as Record<string, unknown>;
  return {
    coins: typeof data.coins === 'number' ? data.coins : 0,
    stars: typeof data.stars === 'number' ? data.stars : 0,
    ownedItemIds: isStringArray(data.ownedItemIds) ? data.ownedItemIds : [],
    equipped: isRecordOfStrings(data.equipped) ? data.equipped : {},
    completedMissionIds: isStringArray(data.completedMissionIds) ? data.completedMissionIds : [],
  };
}
