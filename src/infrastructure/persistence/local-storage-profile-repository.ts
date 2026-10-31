import type { ProfileRepository } from '@application/ports/profile-repository';
import {
  completeProfile,
  type PlayerProfile,
  type ProfileId,
} from '@domain/profile/player-profile';
import { JsonStore } from '@infrastructure/persistence/json-store';
import { PROFILES_KEY, profilePrefix } from '@infrastructure/persistence/storage-keys';

interface StoredProfiles {
  readonly profiles: readonly PlayerProfile[];
  readonly activeId?: ProfileId;
}

type SavedProfile = Parameters<typeof completeProfile>[0];

const isProfile = (value: unknown): value is SavedProfile => {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.avatarId === 'string' &&
    typeof p.createdAt === 'number' &&
    typeof p.lastPlayedAt === 'number'
  );
};

export class LocalStorageProfileRepository implements ProfileRepository {
  private readonly store: JsonStore;

  constructor(storage: Storage | undefined) {
    this.store = new JsonStore(storage);
  }

  list(): Promise<readonly PlayerProfile[]> {
    return Promise.resolve(this.read().profiles);
  }

  save(profile: PlayerProfile): Promise<void> {
    const current = this.read();
    const others = current.profiles.filter((p) => p.id !== profile.id);
    this.write({ ...current, profiles: [...others, profile] });
    return Promise.resolve();
  }

  remove(id: ProfileId): Promise<void> {
    const current = this.read();
    const profiles = current.profiles.filter((p) => p.id !== id);
    this.write(current.activeId === id ? { profiles } : { ...current, profiles });
    for (const key of this.store.keysWithPrefix(profilePrefix(id))) this.store.remove(key);
    return Promise.resolve();
  }

  activeId(): Promise<ProfileId | undefined> {
    return Promise.resolve(this.read().activeId);
  }

  setActiveId(id: ProfileId | undefined): Promise<void> {
    const { profiles } = this.read();
    this.write(id === undefined ? { profiles } : { profiles, activeId: id });
    return Promise.resolve();
  }

  private read(): StoredProfiles {
    const data = this.store.read(PROFILES_KEY);
    if (typeof data !== 'object' || data === null) return { profiles: [] };
    const { profiles, activeId } = data as Record<string, unknown>;
    const valid = Array.isArray(profiles) ? profiles.filter(isProfile).map(completeProfile) : [];
    return typeof activeId === 'string' && valid.some((p) => p.id === activeId)
      ? { profiles: valid, activeId }
      : { profiles: valid };
  }

  private write(value: StoredProfiles): void {
    this.store.write(PROFILES_KEY, value);
  }
}
