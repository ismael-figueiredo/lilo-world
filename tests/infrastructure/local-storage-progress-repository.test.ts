import { beforeEach, describe, expect, it } from 'vitest';
import { PlayerProgress } from '@domain/progress/player-progress';
import { LocalStorageProgressRepository } from '@infrastructure/persistence/local-storage-progress-repository';
import { mission } from '../support/fixtures';
import { MemoryStorage } from '../support/memory-storage';

const PROGRESS_STORAGE_KEY = 'lilo-world:v2:test:progress';

describe('LocalStorageProgressRepository', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('starts fresh when nothing is stored', async () => {
    const progress = await new LocalStorageProgressRepository(storage, PROGRESS_STORAGE_KEY).load();
    expect(progress.toSnapshot()).toEqual(PlayerProgress.createNew().toSnapshot());
  });

  it('saves and loads progress', async () => {
    const repository = new LocalStorageProgressRepository(storage, PROGRESS_STORAGE_KEY);
    const progress = PlayerProgress.createNew().completeMission(mission).progress;
    await repository.save(progress);
    expect((await repository.load()).toSnapshot()).toEqual(progress.toSnapshot());
  });

  it('starts fresh when stored data is corrupted', async () => {
    storage.setItem(PROGRESS_STORAGE_KEY, '{not json');
    const progress = await new LocalStorageProgressRepository(storage, PROGRESS_STORAGE_KEY).load();
    expect(progress.coins.amount).toBe(0);
  });

  it('keeps the story of each skill between days', async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageProgressRepository(storage, 'player');
    await repository.save(PlayerProgress.createNew().recordSkill('math.count.5', true, 5));
    const again = await new LocalStorageProgressRepository(storage, 'player').load();
    expect(again.skillRecord('math.count.5')?.recent).toEqual([true]);
  });

  it('ignores fields with the wrong type', async () => {
    storage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ coins: 'many', stars: 2, ownedItemIds: [1], equipped: [] }),
    );
    const progress = await new LocalStorageProgressRepository(storage, PROGRESS_STORAGE_KEY).load();
    expect(progress.toSnapshot()).toEqual({
      coins: 0,
      stars: 2,
      skillRecords: {},
      ownedItemIds: [],
      equipped: {},
      completedMissionIds: [],
      missionStats: {},
      skillLevels: { letters: 1, numbers: 1, coins: 1, world: 1 },
      stickerIds: [],
      decorIds: [],
      memories: [],
      letters: [],
    });
  });

  it('keeps playing when saving fails (full or blocked storage)', async () => {
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const repository = new LocalStorageProgressRepository(storage, PROGRESS_STORAGE_KEY);
    await expect(repository.save(PlayerProgress.createNew())).resolves.toBeUndefined();
  });

  it('works without storage at all', async () => {
    const repository = new LocalStorageProgressRepository(undefined, PROGRESS_STORAGE_KEY);
    await repository.save(PlayerProgress.createNew());
    expect((await repository.load()).coins.amount).toBe(0);
  });
});
