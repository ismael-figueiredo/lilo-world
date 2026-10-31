import type { ProfileId } from '@domain/profile/player-profile';

/** Version 1 kept a single, profile-less progress entry. */
export const LEGACY_PROGRESS_KEY = 'lilo-world:progress:v1';

export const PROFILES_KEY = 'lilo-world:v2:profiles';

export const profilePrefix = (profileId: ProfileId): string => `lilo-world:v2:${profileId}:`;

export const profileKey = (
  profileId: ProfileId,
  kind: 'progress' | 'settings' | 'session' | 'day' | 'moods',
): string => `${profilePrefix(profileId)}${kind}`;
