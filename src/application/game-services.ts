import type { AudioPlayer } from '@application/ports/audio';
import type { Speech } from '@application/ports/speech';
import type { AnswerActivity } from '@application/use-cases/answer-activity';
import type { ApplySettings } from '@application/use-cases/apply-settings';
import type { BuyWardrobeItem } from '@application/use-cases/buy-wardrobe-item';
import type { ChangeAvatar } from '@application/use-cases/change-avatar';
import type { ChangeChild } from '@application/use-cases/change-child';
import type { CheckSessionTime } from '@application/use-cases/check-session-time';
import type { ChooseMissionAnswer } from '@application/use-cases/choose-mission-answer';
import type { CreateProfile } from '@application/use-cases/create-profile';
import type { DeleteProfile } from '@application/use-cases/delete-profile';
import type { GetActiveProfile } from '@application/use-cases/get-active-profile';
import type { GetAlbum } from '@application/use-cases/get-album';
import type { GetPlayerProgress } from '@application/use-cases/get-player-progress';
import type { GetProgressSummary } from '@application/use-cases/get-progress-summary';
import type { GetSettings } from '@application/use-cases/get-settings';
import type { GetWardrobe } from '@application/use-cases/get-wardrobe';
import type { LeaveMission } from '@application/use-cases/leave-mission';
import type { ListAvatars } from '@application/use-cases/list-avatars';
import type { ListProfiles } from '@application/use-cases/list-profiles';
import type { LoadSession } from '@application/use-cases/load-session';
import type { RenameProfile } from '@application/use-cases/rename-profile';
import type { RewardSafeTrip } from '@application/use-cases/reward-safe-trip';
import type { FollowDay } from '@application/use-cases/follow-day';
import type { MeetAnimal } from '@application/use-cases/meet-animal';
import type { NoteMood } from '@application/use-cases/note-mood';
import type { SaveSession } from '@application/use-cases/save-session';
import type { SelectProfile } from '@application/use-cases/select-profile';
import type { PlanSession } from '@application/use-cases/plan-session';
import type { StartActivity } from '@application/use-cases/start-activity';
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
  readonly suggestNextGoal: SuggestNextGoal;
  readonly startMission: StartMission;
  readonly chooseMissionAnswer: ChooseMissionAnswer;
  readonly leaveMission: LeaveMission;
  readonly rewardSafeTrip: RewardSafeTrip;
  readonly startActivity: StartActivity;
  readonly answerActivity: AnswerActivity;
  readonly planSession: PlanSession;
  readonly getAlbum: GetAlbum;
  readonly getWardrobe: GetWardrobe;
  readonly buyWardrobeItem: BuyWardrobeItem;
  readonly toggleWardrobeItem: ToggleWardrobeItem;
  readonly getSettings: GetSettings;
  readonly updateSettings: UpdateSettings;
  readonly applySettings: ApplySettings;
  readonly saveSession: SaveSession;
  readonly loadSession: LoadSession;
  readonly checkSessionTime: CheckSessionTime;
  readonly followDay: FollowDay;
  readonly noteMood: NoteMood;
  readonly meetAnimal: MeetAnimal;
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
  readonly changeChild: ChangeChild;
  readonly speech: Speech;
  readonly audio: AudioPlayer;
  forPlayer(profileId: ProfileId): PlayerServices;
}
