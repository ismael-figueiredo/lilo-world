import type { SessionState } from '@domain/session/session';

/** Last position of one child in the world (scoped to a profile by the composition root). */
export interface SessionRepository {
  load(): Promise<SessionState | undefined>;
  save(state: SessionState): Promise<void>;
}
