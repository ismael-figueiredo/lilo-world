import type { SettingsRepository } from '@application/ports/settings-repository';
import type { Settings } from '@domain/settings/settings';

export class GetSettings {
  constructor(private readonly settings: SettingsRepository) {}

  execute(): Promise<Settings> {
    return this.settings.load();
  }
}
