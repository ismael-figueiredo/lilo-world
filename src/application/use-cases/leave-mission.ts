import type { Clock } from '@application/ports/clock';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { MissionAttempt } from '@domain/mission/mission-attempt';

/** Leaving early is fine: it is recorded as practice so adults can see the effort. */
export class LeaveMission {
  constructor(
    private readonly progress: ProgressRepository,
    private readonly clock: Clock,
  ) {}

  async execute(attempt: MissionAttempt): Promise<void> {
    if (attempt.isCompleted) return;
    const progress = await this.progress.load();
    await this.progress.save(
      progress.recordAttempt(attempt.mission.id, {
        mistakes: attempt.mistakes,
        at: this.clock.now(),
      }),
    );
  }
}
