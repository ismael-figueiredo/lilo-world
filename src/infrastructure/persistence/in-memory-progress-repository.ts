import type { ProgressRepository } from '@application/ports/progress-repository';
import { PlayerProgress } from '@domain/progress/player-progress';

/** Keeps progress only while the page is open. Useful for tests and for a "guest" mode. */
export class InMemoryProgressRepository implements ProgressRepository {
  constructor(private progress: PlayerProgress = PlayerProgress.createNew()) {}

  load(): Promise<PlayerProgress> {
    return Promise.resolve(this.progress);
  }

  save(progress: PlayerProgress): Promise<void> {
    this.progress = progress;
    return Promise.resolve();
  }
}
