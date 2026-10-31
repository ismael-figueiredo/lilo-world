import { beforeEach, describe, expect, it } from 'vitest';
import { defaultChildChoices } from '@domain/avatar/child';
import { defaultSettings } from '@domain/settings/settings';
import { LocalStorageProfileRepository } from '@infrastructure/persistence/local-storage-profile-repository';
import { LocalStorageSessionRepository } from '@infrastructure/persistence/local-storage-session-repository';
import { LocalStorageSettingsRepository } from '@infrastructure/persistence/local-storage-settings-repository';
import { migrateLegacyProgress } from '@infrastructure/persistence/migrations';
import {
  LEGACY_PROGRESS_KEY,
  PROFILES_KEY,
  profileKey,
} from '@infrastructure/persistence/storage-keys';
import { FixedClock, SequentialIds } from '../support/fixtures';
import { MemoryStorage } from '../support/memory-storage';

const profile = (id: string, name = id) => ({
  id,
  name,
  avatarId: 'robot',
  createdAt: 1,
  lastPlayedAt: 1,
  ...defaultChildChoices,
});

describe('LocalStorageProfileRepository', () => {
  let storage: MemoryStorage;
  let repository: LocalStorageProfileRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repository = new LocalStorageProfileRepository(storage);
  });

  it('saves, updates and lists profiles', async () => {
    await repository.save(profile('a', 'Ana'));
    await repository.save(profile('b', 'Leo'));
    await repository.save(profile('a', 'Aninha'));
    expect((await repository.list()).map((p) => p.name).sort()).toEqual(['Aninha', 'Leo']);
  });

  it('remembers the active profile', async () => {
    await repository.save(profile('a'));
    await repository.setActiveId('a');
    expect(await repository.activeId()).toBe('a');
    await repository.setActiveId(undefined);
    expect(await repository.activeId()).toBeUndefined();
  });

  it('removes a profile together with all of its data', async () => {
    await repository.save(profile('a'));
    await repository.save(profile('b'));
    await repository.setActiveId('a');
    storage.setItem(profileKey('a', 'progress'), '{}');
    storage.setItem(profileKey('a', 'settings'), '{}');
    storage.setItem(profileKey('b', 'progress'), '{}');

    await repository.remove('a');

    expect((await repository.list()).map((p) => p.id)).toEqual(['b']);
    expect(await repository.activeId()).toBeUndefined();
    expect(storage.getItem(profileKey('a', 'progress'))).toBeNull();
    expect(storage.getItem(profileKey('a', 'settings'))).toBeNull();
    expect(storage.getItem(profileKey('b', 'progress'))).toBe('{}');
  });

  it('opens a profile saved before the child creator as it was, keeping the costume', async () => {
    const old = { id: 'a', name: 'Ana', avatarId: 'panda', createdAt: 3, lastPlayedAt: 9 };
    storage.setItem(PROFILES_KEY, JSON.stringify({ profiles: [old], activeId: 'a' }));

    expect(await repository.list()).toEqual([{ ...old, ...defaultChildChoices }]);
    expect(await repository.activeId()).toBe('a');
  });

  it('keeps the choices that were saved and repairs the broken ones', async () => {
    const look = { ...defaultChildChoices.look, hairStyle: 'afro', skin: 123 };
    const saved = { ...profile('a'), look, outfit: 'swim', guardian: 'nobody' };
    storage.setItem(PROFILES_KEY, JSON.stringify({ profiles: [saved] }));

    const [child] = await repository.list();
    expect(child?.look.hairStyle).toBe('afro');
    expect(child?.look.skin).toBe(defaultChildChoices.look.skin);
    expect(child?.outfit).toBe('swim');
    expect(child?.guardian).toBe(defaultChildChoices.guardian);
  });

  it('ignores broken stored data', async () => {
    storage.setItem(PROFILES_KEY, JSON.stringify({ profiles: [{ id: 3 }], activeId: 'ghost' }));
    expect(await repository.list()).toEqual([]);
    expect(await repository.activeId()).toBeUndefined();
  });
});

describe('settings and session storage', () => {
  it('round-trips settings and repairs broken ones', async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageSettingsRepository(storage, 'k');
    expect(await repository.load()).toEqual(defaultSettings);
    await repository.save({ ...defaultSettings, softColors: true });
    expect((await repository.load()).softColors).toBe(true);
    storage.setItem('k', '{"masterVolume": "loud"}');
    expect((await repository.load()).masterVolume).toBe(defaultSettings.masterVolume);
  });

  it('round-trips the session', async () => {
    const repository = new LocalStorageSessionRepository(new MemoryStorage(), 's');
    expect(await repository.load()).toBeUndefined();
    const state = { x: 1, y: 2, z: 3, facing: 0, cameraYaw: 0, savedAt: 5 };
    await repository.save(state);
    expect(await repository.load()).toEqual(state);
  });
});

describe('migrateLegacyProgress', () => {
  it('moves version 1 progress into a first profile', async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_PROGRESS_KEY, JSON.stringify({ coins: 15 }));

    migrateLegacyProgress(storage, new SequentialIds(), new FixedClock(7));

    const profiles = new LocalStorageProfileRepository(storage);
    expect(await profiles.list()).toEqual([
      {
        id: 'id-1',
        name: 'Jogador',
        avatarId: 'robot',
        createdAt: 7,
        lastPlayedAt: 7,
        ...defaultChildChoices,
      },
    ]);
    expect(await profiles.activeId()).toBe('id-1');
    expect(storage.getItem(profileKey('id-1', 'progress'))).toBe('{"coins":15}');
    expect(storage.getItem(LEGACY_PROGRESS_KEY)).toBeNull();
  });

  it('does nothing without old data and never overwrites existing profiles', () => {
    const storage = new MemoryStorage();
    migrateLegacyProgress(storage, new SequentialIds(), new FixedClock());
    expect(storage.length).toBe(0);

    storage.setItem(PROFILES_KEY, '{"profiles":[]}');
    storage.setItem(LEGACY_PROGRESS_KEY, '{}');
    migrateLegacyProgress(storage, new SequentialIds(), new FixedClock());
    expect(storage.getItem(PROFILES_KEY)).toBe('{"profiles":[]}');
    expect(storage.getItem(LEGACY_PROGRESS_KEY)).toBeNull();
  });
});
