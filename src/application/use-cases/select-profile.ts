import type { Clock } from '@application/ports/clock';
import type { ProfileRepository } from '@application/ports/profile-repository';
import type { PlayerProfile, ProfileId } from '@domain/profile/player-profile';
import { domainError, err, ok, type Result } from '@domain/shared/result';

export class SelectProfile {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: ProfileId): Promise<Result<PlayerProfile>> {
    const profile = (await this.profiles.list()).find((p) => p.id === id);
    if (profile === undefined) return err(domainError('not-found', `Profile not found: ${id}`));
    const played = { ...profile, lastPlayedAt: this.clock.now() };
    await this.profiles.save(played);
    await this.profiles.setActiveId(id);
    return ok(played);
  }
}
