import type { Clock } from '@application/ports/clock';
import type { IdGenerator } from '@application/ports/id-generator';
import { defaultChildChoices } from '@domain/avatar/child';
import { DEFAULT_AVATAR_ID, type PlayerProfile } from '@domain/profile/player-profile';
import { JsonStore } from '@infrastructure/persistence/json-store';
import {
  LEGACY_PROGRESS_KEY,
  PROFILES_KEY,
  profileKey,
} from '@infrastructure/persistence/storage-keys';

/**
 * Moves progress saved by version 1 (no profiles) into a first profile, so
 * nobody loses their coins and clothes after the update. Safe to run every start.
 */
export function migrateLegacyProgress(
  storage: Storage | undefined,
  ids: IdGenerator,
  clock: Clock,
): void {
  const store = new JsonStore(storage);
  const legacy = store.read(LEGACY_PROGRESS_KEY);
  if (legacy === undefined) return;
  if (store.read(PROFILES_KEY) !== undefined) {
    store.remove(LEGACY_PROGRESS_KEY);
    return;
  }

  const now = clock.now();
  const profile: PlayerProfile = {
    id: ids.next(),
    name: 'Jogador',
    avatarId: DEFAULT_AVATAR_ID,
    createdAt: now,
    lastPlayedAt: now,
    ...defaultChildChoices,
  };
  store.write(profileKey(profile.id, 'progress'), legacy);
  store.write(PROFILES_KEY, { profiles: [profile], activeId: profile.id });
  store.remove(LEGACY_PROGRESS_KEY);
}
