import type { AudioPlayer } from '@application/ports/audio';
import type { Speech } from '@application/ports/speech';
import type { ApplySettings } from '@application/use-cases/apply-settings';
import type { BuyWardrobeItem } from '@application/use-cases/buy-wardrobe-item';
import type { ChangeAvatar } from '@application/use-cases/change-avatar';
import type { CheckSessionTime } from '@application/use-cases/check-session-time';
import type { ChooseMissionAnswer } from '@application/use-cases/choose-mission-answer';
import type { CreateProfile } from '@application/use-cases/create-profile';
import type { DeleteProfile } from '@application/use-cases/delete-profile';
import type { GetActiveProfile } from '@application/use-cases/get-active-profile';
import type { GetPlayerProgress } from '@application/use-cases/get-player-progress';
import type { GetProgressSummary } from '@application/use-cases/get-progress-summary';
import type { GetSettings } from '@application/use-cases/get-settings';
import type { GetWardrobe } from '@application/use-cases/get-wardrobe';
import type { GetWorldMap } from '@application/use-cases/get-world-map';
import type { LeaveMission } from '@application/use-cases/leave-mission';
import type { ListAvatars } from '@application/use-cases/list-avatars';
import type { ListProfiles } from '@application/use-cases/list-profiles';
import type { LoadSession } from '@application/use-cases/load-session';
import type { RenameProfile } from '@application/use-cases/rename-profile';
import type { SaveSession } from '@application/use-cases/save-session';
import type { SelectProfile } from '@application/use-cases/select-profile';
import type { StartMission } from '@application/use-cases/start-mission';
import type { SuggestNextGoal } from '@application/use-cases/suggest-next-goal';
import type { ToggleWardrobeItem } from '@application/use-cases/toggle-wardrobe-item';
import type { UpdateSettings } from '@application/use-cases/update-settings';
import type { ProfileId } from '@domain/profile/player-profile';

/**
 * What the user interface may do for one child. Every repository behind these
 * use cases is scoped to that child's profile by the composition root.
 */
export interface PlayerServices {
  readonly getPlayerProgress: GetPlayerProgress;
  readonly getProgressSummary: GetProgressSummary;
  readonly getWorldMap: GetWorldMap;
  readonly suggestNextGoal: SuggestNextGoal;
  readonly startMission: StartMission;
  readonly chooseMissionAnswer: ChooseMissionAnswer;
  readonly leaveMission: LeaveMission;
  readonly getWardrobe: GetWardrobe;
  readonly buyWardrobeItem: BuyWardrobeItem;
  readonly toggleWardrobeItem: ToggleWardrobeItem;
  readonly getSettings: GetSettings;
  readonly updateSettings: UpdateSettings;
  readonly applySettings: ApplySettings;
  readonly saveSession: SaveSession;
  readonly loadSession: LoadSession;
  readonly checkSessionTime: CheckSessionTime;
}

/**
 * Everything the user interface is allowed to do. The presentation layer
 * depends on this contract only; the composition root (src/main) builds it.
 */
export interface GameServices {
  readonly listProfiles: ListProfiles;
  readonly createProfile: CreateProfile;
  readonly selectProfile: SelectProfile;
  readonly renameProfile: RenameProfile;
  readonly deleteProfile: DeleteProfile;
  readonly getActiveProfile: GetActiveProfile;
  readonly listAvatars: ListAvatars;
  readonly changeAvatar: ChangeAvatar;
  readonly speech: Speech;
  readonly audio: AudioPlayer;
  forPlayer(profileId: ProfileId): PlayerServices;
}
