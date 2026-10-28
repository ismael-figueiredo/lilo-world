import type { ProgressRepository } from '@application/ports/progress-repository';
import {
  PlayerProgress,
  type MissionStats,
  type ProgressSnapshot,
} from '@domain/progress/player-progress';
import { JsonStore } from '@infrastructure/persistence/json-store';

/**
 * Stores one child's progress in the browser of this device only. Missing,
 * blocked or broken storage falls back to a fresh start instead of failing.
 */
export class LocalStorageProgressRepository implements ProgressRepository {
  private readonly store: JsonStore;

  constructor(
    storage: Storage | undefined,
    private readonly key: string,
  ) {
    this.store = new JsonStore(storage);
  }

  load(): Promise<PlayerProgress> {
    const data = this.store.read(this.key);
    return Promise.resolve(
      data === undefined
        ? PlayerProgress.createNew()
        : PlayerProgress.fromSnapshot(parseSnapshot(data)),
    );
  }

  save(progress: PlayerProgress): Promise<void> {
    this.store.write(this.key, progress.toSnapshot());
    return Promise.resolve();
  }
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRecordOfStrings = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');

function parseStats(value: unknown): Record<string, MissionStats> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
      .map(([id, s]) => [
        id,
        {
          attempts: Number(s.attempts) || 0,
          completions: Number(s.completions) || 0,
          mistakes: Number(s.mistakes) || 0,
          lastPlayedAt: Number(s.lastPlayedAt) || 0,
        },
      ]),
  );
}

function parseSnapshot(raw: unknown): ProgressSnapshot {
  const data = isRecord(raw) ? raw : {};
  return {
    coins: typeof data.coins === 'number' ? data.coins : 0,
    stars: typeof data.stars === 'number' ? data.stars : 0,
    ownedItemIds: isStringArray(data.ownedItemIds) ? data.ownedItemIds : [],
    equipped: isRecordOfStrings(data.equipped) ? data.equipped : {},
    completedMissionIds: isStringArray(data.completedMissionIds) ? data.completedMissionIds : [],
    missionStats: parseStats(data.missionStats),
    skillLevels: isRecord(data.skillLevels)
      ? Object.fromEntries(
          Object.entries(data.skillLevels).filter(([, level]) => typeof level === 'number'),
        )
      : {},
    stickerIds: isStringArray(data.stickerIds) ? data.stickerIds : [],
    letters: isStringArray(data.letters) ? data.letters : [],
  };
}
