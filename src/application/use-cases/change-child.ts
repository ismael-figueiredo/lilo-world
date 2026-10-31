import type { ProfileRepository } from '@application/ports/profile-repository';
import type { ChildChoices } from '@domain/avatar/child';
import type { PlayerProfile, ProfileId } from '@domain/profile/player-profile';
import { domainError, err, ok, type Result } from '@domain/shared/result';

/** Saves what the child changed about themself: look, clothes or the adult at home. */
export class ChangeChild {
  constructor(private readonly profiles: ProfileRepository) {}

  async execute(
    profileId: ProfileId,
    changes: Partial<ChildChoices>,
  ): Promise<Result<PlayerProfile>> {
    const profile = (await this.profiles.list()).find((p) => p.id === profileId);
    if (profile === undefined) {
      return err(domainError('not-found', `Profile not found: ${profileId}`));
    }
    const changed = { ...profile, ...changes };
    await this.profiles.save(changed);
    return ok(changed);
  }
}
