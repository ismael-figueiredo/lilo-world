import type { ProfileRepository } from '@application/ports/profile-repository';
import { renameProfile, type PlayerProfile, type ProfileId } from '@domain/profile/player-profile';
import { domainError, err, type Result } from '@domain/shared/result';

export class RenameProfile {
  constructor(private readonly profiles: ProfileRepository) {}

  async execute(id: ProfileId, name: string): Promise<Result<PlayerProfile>> {
    const profile = (await this.profiles.list()).find((p) => p.id === id);
    if (profile === undefined) return err(domainError('not-found', `Profile not found: ${id}`));
    const renamed = renameProfile(profile, name);
    if (renamed.ok) await this.profiles.save(renamed.value);
    return renamed;
  }
}
