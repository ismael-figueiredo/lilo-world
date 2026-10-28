import { beforeEach, describe, expect, it } from 'vitest';
import { PlayerProgress } from '@domain/progress/player-progress';
import {
  LocalStorageProgressRepository,
  PROGRESS_STORAGE_KEY,
} from '@infrastructure/persistence/local-storage-progress-repository';
import { mission } from '../support/fixtures';
import { MemoryStorage } from '../support/memory-storage';

describe('LocalStorageProgressRepository', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('starts fresh when nothing is stored', async () => {
    const progress = await new LocalStorageProgressRepository(storage).load();
    expect(progress.toSnapshot()).toEqual(PlayerProgress.createNew().toSnapshot());
  });

  it('saves and loads progress', async () => {
    const repository = new LocalStorageProgressRepository(storage);
    const progress = PlayerProgress.createNew().completeMission(mission).progress;
    await repository.save(progress);
    expect((await repository.load()).toSnapshot()).toEqual(progress.toSnapshot());
  });

  it('starts fresh when stored data is corrupted', async () => {
    storage.setItem(PROGRESS_STORAGE_KEY, '{not json');
    const progress = await new LocalStorageProgressRepository(storage).load();
    expect(progress.coins.amount).toBe(0);
  });

  it('ignores fields with the wrong type', async () => {
    storage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ coins: 'many', stars: 2, ownedItemIds: [1], equipped: [] }),
    );
    const progress = await new LocalStorageProgressRepository(storage).load();
    expect(progress.toSnapshot()).toEqual({
      coins: 0,
      stars: 2,
      ownedItemIds: [],
      equipped: {},
      completedMissionIds: [],
    });
  });

  it('keeps playing when saving fails (full or blocked storage)', async () => {
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const repository = new LocalStorageProgressRepository(storage);
    await expect(repository.save(PlayerProgress.createNew())).resolves.toBeUndefined();
  });

  it('works without storage at all', async () => {
    const repository = new LocalStorageProgressRepository(undefined);
    await repository.save(PlayerProgress.createNew());
    expect((await repository.load()).coins.amount).toBe(0);
  });
});
