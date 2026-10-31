import type { DayState } from '@domain/day/day-plan';

/** Where one child is in the day (scoped to a profile by the composition root). */
export interface DayRepository {
  load(): Promise<DayState>;
  save(day: DayState): Promise<void>;
}
