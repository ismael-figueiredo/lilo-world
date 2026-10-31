import type { DayRepository } from '@application/ports/day-repository';
import {
  completeStep,
  skipBlock,
  type DayState,
  type StepId,
  type StepResult,
} from '@domain/day/day-plan';

/** Keeps the day saved at every step, so it resumes exactly where it stopped. */
export class FollowDay {
  constructor(private readonly days: DayRepository) {}

  load(): Promise<DayState> {
    return this.days.load();
  }

  async complete(step: StepId): Promise<StepResult> {
    const result = completeStep(await this.days.load(), step);
    if (result.counted) await this.days.save(result.day);
    return result;
  }

  async skipBlock(): Promise<DayState> {
    const day = skipBlock(await this.days.load());
    await this.days.save(day);
    return day;
  }
}
