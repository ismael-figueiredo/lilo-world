import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProfileRepository } from '@application/ports/profile-repository';
import type { AvatarId } from '@domain/avatar/avatar';
import type { PlayerProfile, ProfileId } from '@domain/profile/player-profile';
import { domainError, err, ok, type Result } from '@domain/shared/result';

/** Lets the child pick another character. Clothes and coins stay the same. */
export class ChangeAvatar {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly catalog: ContentCatalog,
  ) {}

  async execute(profileId: ProfileId, avatarId: AvatarId): Promise<Result<PlayerProfile>> {
    if ((await this.catalog.findAvatar(avatarId)) === undefined) {
      return err(domainError('not-found', `Avatar not found: ${avatarId}`));
    }
    const profile = (await this.profiles.list()).find((p) => p.id === profileId);
    if (profile === undefined) {
      return err(domainError('not-found', `Profile not found: ${profileId}`));
    }
    const changed = { ...profile, avatarId };
    await this.profiles.save(changed);
    return ok(changed);
  }
}
