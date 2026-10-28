import type { SessionRepository } from '@application/ports/session-repository';
import type { SessionState } from '@domain/session/session';

export class LoadSession {
  constructor(private readonly sessions: SessionRepository) {}

  execute(): Promise<SessionState | undefined> {
    return this.sessions.load();
  }
}
