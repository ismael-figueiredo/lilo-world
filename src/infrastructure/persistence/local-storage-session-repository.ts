import type { SessionRepository } from '@application/ports/session-repository';
import { sanitizeSession, type SessionState } from '@domain/session/session';
import { JsonStore } from '@infrastructure/persistence/json-store';

export class LocalStorageSessionRepository implements SessionRepository {
  private readonly store: JsonStore;

  constructor(
    storage: Storage | undefined,
    private readonly key: string,
  ) {
    this.store = new JsonStore(storage);
  }

  load(): Promise<SessionState | undefined> {
    return Promise.resolve(sanitizeSession(this.store.read(this.key)));
  }

  save(state: SessionState): Promise<void> {
    this.store.write(this.key, state);
    return Promise.resolve();
  }
}
