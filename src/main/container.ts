import type { GameServices, PlayerServices } from '@application/game-services';
import type { AudioPlayer } from '@application/ports/audio';
import type { Clock } from '@application/ports/clock';
import type { ContentCatalog } from '@application/ports/content-catalog';
import type { RandomSource } from '@application/ports/random';
import type { IdGenerator } from '@application/ports/id-generator';
import type { DayRepository } from '@application/ports/day-repository';
import type { MoodRepository } from '@application/ports/mood-repository';
import type { ProfileRepository } from '@application/ports/profile-repository';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { SessionRepository } from '@application/ports/session-repository';
import type { SettingsRepository } from '@application/ports/settings-repository';
import type { Speech } from '@application/ports/speech';
import { AnswerActivity } from '@application/use-cases/answer-activity';
import { ApplySettings } from '@application/use-cases/apply-settings';
import { BuyWardrobeItem } from '@application/use-cases/buy-wardrobe-item';
import { ChangeAvatar } from '@application/use-cases/change-avatar';
import { ChangeChild } from '@application/use-cases/change-child';
import { CheckSessionTime } from '@application/use-cases/check-session-time';
import { ChooseMissionAnswer } from '@application/use-cases/choose-mission-answer';
import { CreateProfile } from '@application/use-cases/create-profile';
import { DeleteProfile } from '@application/use-cases/delete-profile';
import { GetActiveProfile } from '@application/use-cases/get-active-profile';
import { GetAlbum } from '@application/use-cases/get-album';
import { GetPlayerProgress } from '@application/use-cases/get-player-progress';
import { GetProgressSummary } from '@application/use-cases/get-progress-summary';
import { GetSettings } from '@application/use-cases/get-settings';
import { GetWardrobe } from '@application/use-cases/get-wardrobe';
import { LeaveMission } from '@application/use-cases/leave-mission';
import { ListAvatars } from '@application/use-cases/list-avatars';
import { ListProfiles } from '@application/use-cases/list-profiles';
import { LoadSession } from '@application/use-cases/load-session';
import { RenameProfile } from '@application/use-cases/rename-profile';
import { RewardSafeTrip } from '@application/use-cases/reward-safe-trip';
import { SaveSession } from '@application/use-cases/save-session';
import { SelectProfile } from '@application/use-cases/select-profile';
import { PlanSession } from '@application/use-cases/plan-session';
import { StartActivity } from '@application/use-cases/start-activity';
import { StartMission } from '@application/use-cases/start-mission';
import { SuggestNextGoal } from '@application/use-cases/suggest-next-goal';
import { FollowDay } from '@application/use-cases/follow-day';
import { MeetAnimal } from '@application/use-cases/meet-animal';
import { NoteMood } from '@application/use-cases/note-mood';
import { ToggleWardrobeItem } from '@application/use-cases/toggle-wardrobe-item';
import { UpdateSettings } from '@application/use-cases/update-settings';
import type { ProfileId } from '@domain/profile/player-profile';
import { SilentAudio } from '@infrastructure/audio/silent-audio';
import { WebAudioPlayer } from '@infrastructure/audio/web-audio-player';
import { StaticContentCatalog } from '@infrastructure/catalog/static-content-catalog';
import { LocalStorageDayRepository } from '@infrastructure/persistence/local-storage-day-repository';
import { LocalStorageMoodRepository } from '@infrastructure/persistence/local-storage-mood-repository';
import { LocalStorageProfileRepository } from '@infrastructure/persistence/local-storage-profile-repository';
import { LocalStorageProgressRepository } from '@infrastructure/persistence/local-storage-progress-repository';
import { LocalStorageSessionRepository } from '@infrastructure/persistence/local-storage-session-repository';
import { LocalStorageSettingsRepository } from '@infrastructure/persistence/local-storage-settings-repository';
import { migrateLegacyProgress } from '@infrastructure/persistence/migrations';
import { profileKey } from '@infrastructure/persistence/storage-keys';
import { SilentSpeech } from '@infrastructure/speech/silent-speech';
import { WebSpeech } from '@infrastructure/speech/web-speech';
import { RandomIdGenerator } from '@infrastructure/system/random-id-generator';
import { SystemClock } from '@infrastructure/system/system-clock';

/** Repositories that belong to one child. */
export interface PlayerStores {
  readonly progress: ProgressRepository;
  readonly settings: SettingsRepository;
  readonly session: SessionRepository;
  readonly day: DayRepository;
  readonly moods: MoodRepository;
}

export interface Adapters {
  readonly catalog: ContentCatalog;
  readonly profiles: ProfileRepository;
  readonly storesFor: (profileId: ProfileId) => PlayerStores;
  readonly speech: Speech;
  readonly audio: AudioPlayer;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** New challenges; Math.random when not given. */
  readonly random?: RandomSource;
}

/** Wires use cases to whatever adapters are given. Tests pass fakes; the browser passes real ones. */
export function createServices(adapters: Adapters): GameServices {
  const { catalog, profiles, speech, audio, clock, ids } = adapters;
  const random = adapters.random ?? Math.random;
  const players = new Map<ProfileId, PlayerServices>();

  const buildPlayer = (profileId: ProfileId): PlayerServices => {
    const { progress, settings, session, day, moods } = adapters.storesFor(profileId);
    const applySettings = new ApplySettings(settings, audio, speech);
    return {
      getPlayerProgress: new GetPlayerProgress(progress),
      getProgressSummary: new GetProgressSummary(catalog, progress),
      suggestNextGoal: new SuggestNextGoal(catalog, progress),
      startMission: new StartMission(catalog, speech, random),
      chooseMissionAnswer: new ChooseMissionAnswer(progress, speech, clock),
      leaveMission: new LeaveMission(progress, clock),
      rewardSafeTrip: new RewardSafeTrip(progress),
      startActivity: new StartActivity(catalog, progress, speech, random),
      answerActivity: new AnswerActivity(catalog, progress, speech, random, clock),
      planSession: new PlanSession(catalog, progress, settings, clock),
      getAlbum: new GetAlbum(progress),
      getWardrobe: new GetWardrobe(catalog, progress),
      buyWardrobeItem: new BuyWardrobeItem(catalog, progress),
      toggleWardrobeItem: new ToggleWardrobeItem(catalog, progress),
      getSettings: new GetSettings(settings),
      updateSettings: new UpdateSettings(settings, applySettings),
      applySettings,
      saveSession: new SaveSession(session, clock),
      loadSession: new LoadSession(session),
      checkSessionTime: new CheckSessionTime(settings),
      followDay: new FollowDay(day),
      noteMood: new NoteMood(moods, clock),
      meetAnimal: new MeetAnimal(progress),
    };
  };

  return {
    listProfiles: new ListProfiles(profiles),
    createProfile: new CreateProfile(profiles, ids, clock),
    selectProfile: new SelectProfile(profiles, clock),
    renameProfile: new RenameProfile(profiles),
    deleteProfile: new DeleteProfile(profiles),
    getActiveProfile: new GetActiveProfile(profiles),
    listAvatars: new ListAvatars(catalog),
    changeAvatar: new ChangeAvatar(profiles, catalog),
    changeChild: new ChangeChild(profiles),
    speech,
    audio,
    forPlayer(profileId) {
      let player = players.get(profileId);
      if (player === undefined) {
        player = buildPlayer(profileId);
        players.set(profileId, player);
      }
      return player;
    },
  };
}

/** Composition root for the browser. The only place that knows concrete adapters. */
export function createBrowserAdapters(win: Window = window): Adapters {
  const storage = safeLocalStorage(win);
  const clock = new SystemClock();
  const ids = new RandomIdGenerator();
  migrateLegacyProgress(storage, ids, clock);

  return {
    catalog: new StaticContentCatalog(),
    profiles: new LocalStorageProfileRepository(storage),
    storesFor: (profileId) => ({
      progress: new LocalStorageProgressRepository(storage, profileKey(profileId, 'progress')),
      settings: new LocalStorageSettingsRepository(storage, profileKey(profileId, 'settings')),
      session: new LocalStorageSessionRepository(storage, profileKey(profileId, 'session')),
      day: new LocalStorageDayRepository(storage, profileKey(profileId, 'day')),
      moods: new LocalStorageMoodRepository(storage, profileKey(profileId, 'moods')),
    }),
    speech:
      'speechSynthesis' in win
        ? new WebSpeech(win.speechSynthesis, (text) => new SpeechSynthesisUtterance(text))
        : new SilentSpeech(),
    audio: 'AudioContext' in win ? new WebAudioPlayer(() => new AudioContext()) : new SilentAudio(),
    clock,
    ids,
  };
}

function safeLocalStorage(win: Window): Storage | undefined {
  try {
    return win.localStorage;
  } catch {
    return undefined;
  }
}
