import type { MoodRepository } from '@application/ports/mood-repository';
import type { MoodNote } from '@domain/feelings/mood';
import type { DayRepository } from '@application/ports/day-repository';
import type { ProfileRepository } from '@application/ports/profile-repository';
import type { SessionRepository } from '@application/ports/session-repository';
import type { SettingsRepository } from '@application/ports/settings-repository';
import { firstDay, type DayState } from '@domain/day/day-plan';
import type { PlayerProfile, ProfileId } from '@domain/profile/player-profile';
import type { SessionState } from '@domain/session/session';
import { defaultSettings, type Settings } from '@domain/settings/settings';

/** Keep data only while the page is open. Useful for tests and for a guest mode. */
export class InMemoryProfileRepository implements ProfileRepository {
  private profiles: PlayerProfile[] = [];
  private active: ProfileId | undefined;
  readonly removed: ProfileId[] = [];

  list(): Promise<readonly PlayerProfile[]> {
    return Promise.resolve([...this.profiles]);
  }

  save(profile: PlayerProfile): Promise<void> {
    this.profiles = [...this.profiles.filter((p) => p.id !== profile.id), profile];
    return Promise.resolve();
  }

  remove(id: ProfileId): Promise<void> {
    this.profiles = this.profiles.filter((p) => p.id !== id);
    this.removed.push(id);
    if (this.active === id) this.active = undefined;
    return Promise.resolve();
  }

  activeId(): Promise<ProfileId | undefined> {
    return Promise.resolve(this.active);
  }

  setActiveId(id: ProfileId | undefined): Promise<void> {
    this.active = id;
    return Promise.resolve();
  }
}

export class InMemorySettingsRepository implements SettingsRepository {
  constructor(private settings: Settings = defaultSettings) {}

  load(): Promise<Settings> {
    return Promise.resolve(this.settings);
  }

  save(settings: Settings): Promise<void> {
    this.settings = settings;
    return Promise.resolve();
  }
}

export class InMemoryDayRepository implements DayRepository {
  constructor(private day: DayState = firstDay) {}

  load(): Promise<DayState> {
    return Promise.resolve(this.day);
  }

  save(day: DayState): Promise<void> {
    this.day = day;
    return Promise.resolve();
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private state: SessionState | undefined;

  load(): Promise<SessionState | undefined> {
    return Promise.resolve(this.state);
  }

  save(state: SessionState): Promise<void> {
    this.state = state;
    return Promise.resolve();
  }
}

export class InMemoryMoodRepository implements MoodRepository {
  private notes: readonly MoodNote[] = [];

  load(): Promise<readonly MoodNote[]> {
    return Promise.resolve(this.notes);
  }

  save(notes: readonly MoodNote[]): Promise<void> {
    this.notes = notes;
    return Promise.resolve();
  }
}
