import type { PlayerProfile, ProfileId } from '@domain/profile/player-profile';

/** The children registered on this device. Stays on the device, like everything else. */
export interface ProfileRepository {
  list(): Promise<readonly PlayerProfile[]>;
  save(profile: PlayerProfile): Promise<void>;
  /** Removes the profile and every piece of data saved for it. */
  remove(id: ProfileId): Promise<void>;
  activeId(): Promise<ProfileId | undefined>;
  setActiveId(id: ProfileId | undefined): Promise<void>;
}
