import type { MoodRepository } from '@application/ports/mood-repository';
import { sanitizeMoods, type MoodNote } from '@domain/feelings/mood';
import { JsonStore } from '@infrastructure/persistence/json-store';

export class LocalStorageMoodRepository implements MoodRepository {
  private readonly store: JsonStore;

  constructor(
    storage: Storage | undefined,
    private readonly key: string,
  ) {
    this.store = new JsonStore(storage);
  }

  load(): Promise<readonly MoodNote[]> {
    return Promise.resolve(sanitizeMoods(this.store.read(this.key)));
  }

  save(notes: readonly MoodNote[]): Promise<void> {
    this.store.write(this.key, notes);
    return Promise.resolve();
  }
}
