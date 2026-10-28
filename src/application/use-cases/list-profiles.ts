import type { ProfileRepository } from '@application/ports/profile-repository';
import { sortProfiles, type PlayerProfile } from '@domain/profile/player-profile';

export class ListProfiles {
  constructor(private readonly profiles: ProfileRepository) {}

  async execute(): Promise<readonly PlayerProfile[]> {
    return sortProfiles(await this.profiles.list());
  }
}
