import type { Clock } from '@application/ports/clock';
import type { SessionRepository } from '@application/ports/session-repository';
import type { SessionState } from '@domain/session/session';

export class SaveSession {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly clock: Clock,
  ) {}

  execute(state: Omit<SessionState, 'savedAt'>): Promise<void> {
    return this.sessions.save({ ...state, savedAt: this.clock.now() });
  }
}
