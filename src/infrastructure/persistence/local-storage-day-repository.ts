import type { DayRepository } from '@application/ports/day-repository';
import { sanitizeDay, type DayState } from '@domain/day/day-plan';
import { JsonStore } from '@infrastructure/persistence/json-store';

export class LocalStorageDayRepository implements DayRepository {
  private readonly store: JsonStore;

  constructor(
    storage: Storage | undefined,
    private readonly key: string,
  ) {
    this.store = new JsonStore(storage);
  }

  load(): Promise<DayState> {
    return Promise.resolve(sanitizeDay(this.store.read(this.key)));
  }

  save(day: DayState): Promise<void> {
    this.store.write(this.key, day);
    return Promise.resolve();
  }
}
