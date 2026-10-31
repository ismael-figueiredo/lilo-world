import { describe, expect, it } from 'vitest';
import { FollowDay } from '@application/use-cases/follow-day';
import { PlanSession } from '@application/use-cases/plan-session';
import { currentStep } from '@domain/day/day-plan';
import { PlayerProgress } from '@domain/progress/player-progress';
import { StaticContentCatalog } from '@infrastructure/catalog/static-content-catalog';
import { InMemoryProgressRepository } from '@infrastructure/persistence/in-memory-progress-repository';
import {
  InMemoryDayRepository,
  InMemorySettingsRepository,
} from '@infrastructure/persistence/in-memory-repositories';
import { content, FixedClock } from '../support/fixtures';

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

describe('the lunch task', () => {
  it('plans it once and keeps every change with the day', async () => {
    const days = new InMemoryDayRepository();
    const follow = new FollowDay(days);
    const errand = await follow.startErrand('exact');
    expect(await follow.startErrand('cents')).toEqual(errand);
    await follow.saveErrand({ ...errand, stage: 'shop' });
    expect((await days.load()).errand?.stage).toBe('shop');
  });
});

describe('the money of the task', () => {
  const DAY = 86_400_000;
  const practiced = (ids: readonly string[]): PlayerProgress => {
    let progress = PlayerProgress.createNew();
    for (const id of ids) {
      for (let answer = 1; answer <= 12; answer += 1) {
        progress = progress.recordSkill(id, true, answer * DAY);
      }
    }
    return progress;
  };
  const levelOf = (ids: readonly string[]) =>
    new PlanSession(
      new StaticContentCatalog(content),
      new InMemoryProgressRepository(practiced(ids)),
      new InMemorySettingsRepository(),
      new FixedClock(13 * DAY),
    ).moneyLevel();

  it('follows what the child already does in math', async () => {
    await expect(levelOf([])).resolves.toBe('exact');
    await expect(levelOf(['math.cash.2'])).resolves.toBe('change');
    await expect(levelOf(['math.cash.2', 'math.cash.3'])).resolves.toBe('cents');
  });
});
