import type { DayRepository } from '@application/ports/day-repository';
import {
  completeStep,
  skipBlock,
  type DayState,
  type StepId,
  type StepResult,
} from '@domain/day/day-plan';

import { planErrand, type Errand, type MoneyLevel } from '@domain/errand/errand';

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

  /** Today's task, ready for the adult to give. The day decides what it is. */
  async startErrand(level: MoneyLevel): Promise<Errand> {
    const day = await this.days.load();
    const errand = day.errand ?? planErrand(day.number, level);
    await this.days.save({ ...day, errand });
    return errand;
  }

  async saveErrand(errand: Errand): Promise<void> {
    await this.days.save({ ...(await this.days.load()), errand });
  }

  async skipBlock(): Promise<DayState> {
    const day = skipBlock(await this.days.load());
    await this.days.save(day);
    return day;
  }
}
