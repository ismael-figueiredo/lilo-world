import type { ProfileRepository } from '@application/ports/profile-repository';
import type { PlayerProfile } from '@domain/profile/player-profile';

export class GetActiveProfile {
  constructor(private readonly profiles: ProfileRepository) {}

  async execute(): Promise<PlayerProfile | undefined> {
    const id = await this.profiles.activeId();
    if (id === undefined) return undefined;
    return (await this.profiles.list()).find((profile) => profile.id === id);
  }
}
