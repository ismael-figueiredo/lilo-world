import type { SettingsRepository } from '@application/ports/settings-repository';
import type { ApplySettings } from '@application/use-cases/apply-settings';
import { updateSettings, type Settings } from '@domain/settings/settings';

export class UpdateSettings {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly applySettings: ApplySettings,
  ) {}

  async execute(patch: Partial<Settings>): Promise<Settings> {
    const next = updateSettings(await this.settings.load(), patch);
    await this.settings.save(next);
    this.applySettings.apply(next);
    return next;
  }
}
