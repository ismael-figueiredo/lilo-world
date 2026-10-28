import type { ProgressRepository } from '@application/ports/progress-repository';
import type { PlayerProgress } from '@domain/progress/player-progress';

export class GetPlayerProgress {
  constructor(private readonly progress: ProgressRepository) {}

  execute(): Promise<PlayerProgress> {
    return this.progress.load();
  }
}
