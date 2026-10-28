import type { ProfileRepository } from '@application/ports/profile-repository';
import type { ProfileId } from '@domain/profile/player-profile';

/** Removes a child and all their data. The UI keeps this behind the parents' area. */
export class DeleteProfile {
  constructor(private readonly profiles: ProfileRepository) {}

  async execute(id: ProfileId): Promise<void> {
    if ((await this.profiles.activeId()) === id) await this.profiles.setActiveId(undefined);
    await this.profiles.remove(id);
  }
}
