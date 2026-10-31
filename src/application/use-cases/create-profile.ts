import type { Clock } from '@application/ports/clock';
import type { IdGenerator } from '@application/ports/id-generator';
import type { ProfileRepository } from '@application/ports/profile-repository';
import type { ChildChoices } from '@domain/avatar/child';
import { createProfile, type PlayerProfile } from '@domain/profile/player-profile';
import type { Result } from '@domain/shared/result';

/** Registers a new child and makes them the active player. */
export class CreateProfile {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    name: string,
    avatarId: string,
    choices?: ChildChoices,
  ): Promise<Result<PlayerProfile>> {
    const profile = createProfile(this.ids.next(), name, avatarId, this.clock.now(), choices);
    if (!profile.ok) return profile;
    await this.profiles.save(profile.value);
    await this.profiles.setActiveId(profile.value.id);
    return profile;
  }
}
