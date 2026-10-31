import { describe, expect, it } from 'vitest';
import { FollowDay } from '@application/use-cases/follow-day';
import { currentStep } from '@domain/day/day-plan';
import { InMemoryDayRepository } from '@infrastructure/persistence/in-memory-repositories';

describe('FollowDay', () => {
  it('saves every step, so a new visit resumes at the right one', async () => {
    const days = new InMemoryDayRepository();
    await new FollowDay(days).complete('wake');
    expect(currentStep(await new FollowDay(days).load())).toBe('eat');
  });

  it('saves a jumped block', async () => {
    const days = new InMemoryDayRepository();
    await new FollowDay(days).skipBlock();
    expect(currentStep(await days.load())).toBe('lunch');
  });
});
