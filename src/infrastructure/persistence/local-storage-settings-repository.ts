import type { SettingsRepository } from '@application/ports/settings-repository';
import { sanitizeSettings, type Settings } from '@domain/settings/settings';
import { JsonStore } from '@infrastructure/persistence/json-store';

export class LocalStorageSettingsRepository implements SettingsRepository {
  private readonly store: JsonStore;

  constructor(
    storage: Storage | undefined,
    private readonly key: string,
  ) {
    this.store = new JsonStore(storage);
  }

  load(): Promise<Settings> {
    return Promise.resolve(sanitizeSettings(this.store.read(this.key)));
  }

  save(settings: Settings): Promise<void> {
    this.store.write(this.key, settings);
    return Promise.resolve();
  }
}
