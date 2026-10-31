import type { ProgressRepository } from '@application/ports/progress-repository';
import type { DayState } from '@domain/day/day-plan';

/** At bedtime, what the child did today goes to the album. */
export class KeepDayMemory {
  constructor(private readonly progress: ProgressRepository) {}

  async execute(day: DayState): Promise<void> {
    const progress = await this.progress.load();
    await this.progress.save(progress.withMemory({ day: day.number, steps: day.done }));
  }
}
