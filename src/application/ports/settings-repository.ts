import type { Settings } from '@domain/settings/settings';

/** Settings of one child (the composition root scopes it to a profile). */
export interface SettingsRepository {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}
