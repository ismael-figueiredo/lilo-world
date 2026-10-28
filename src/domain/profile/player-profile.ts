import { domainError, err, ok, type Result } from '@domain/shared/result';

export type ProfileId = string;

/** One child playing on this device. Several children can share a tablet. */
export interface PlayerProfile {
  readonly id: ProfileId;
  readonly name: string;
  readonly avatarId: string;
  readonly createdAt: number;
  readonly lastPlayedAt: number;
}

export const MAX_NAME_LENGTH = 20;
export const DEFAULT_AVATAR_ID = 'robot';

/** Trims and collapses spaces; a name needs 1 to 20 characters. */
export function normalizeName(raw: string): Result<string> {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return err(domainError('invalid-name', `Name must have 1 to ${MAX_NAME_LENGTH} characters`));
  }
  return ok(name);
}

export function createProfile(
  id: ProfileId,
  rawName: string,
  avatarId: string,
  now: number,
): Result<PlayerProfile> {
  const name = normalizeName(rawName);
  if (!name.ok) return name;
  return ok({ id, name: name.value, avatarId, createdAt: now, lastPlayedAt: now });
}

export function renameProfile(profile: PlayerProfile, rawName: string): Result<PlayerProfile> {
  const name = normalizeName(rawName);
  if (!name.ok) return name;
  return ok({ ...profile, name: name.value });
}

/** Most recently played first, so the child usually finds their card at the start. */
export const sortProfiles = (profiles: readonly PlayerProfile[]): PlayerProfile[] =>
  [...profiles].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
