import { describe, expect, it } from 'vitest';
import { BuyDecor } from '@application/use-cases/buy-decor';
import { KeepDayMemory } from '@application/use-cases/keep-day-memory';
import { firstDay, dayBlocks } from '@domain/day/day-plan';
import { stories, storyOfDay } from '@domain/day/stories';
import { PlayerProgress, type ProgressSnapshot } from '@domain/progress/player-progress';
import { decorItems, isDecor } from '@domain/reward/room-decor';
import { InMemoryProgressRepository } from '@infrastructure/persistence/in-memory-progress-repository';

describe('the night', () => {
  it('has dinner, a bath, teeth, pajamas and bed, in that order', () => {
    expect(dayBlocks.at(-1)?.steps).toEqual(['dinner', 'shower', 'brush', 'pajamas', 'sleep']);
  });

  it('has short stories, the same one on the same day', () => {
    for (const story of stories) expect(story.lines.length).toBeLessThanOrEqual(5);
    expect(storyOfDay(2)).toBe(storyOfDay(2 + stories.length));
  });
});

describe('the day in the album', () => {
  it('keeps only the latest days', async () => {
    const progress = new InMemoryProgressRepository();
    const keep = new KeepDayMemory(progress);
    for (let number = 1; number <= 10; number += 1) {
      await keep.execute({ ...firstDay, number, done: ['wake'] });
    }
    const { memories } = await progress.load();
    expect(memories).toHaveLength(7);
    expect(memories.at(-1)?.day).toBe(10);
  });

  it('survives a save, and old saves simply have none', () => {
    const progress = PlayerProgress.createNew().withMemory({ day: 3, steps: ['wake'] });
    expect(PlayerProgress.fromSnapshot(progress.toSnapshot()).memories).toEqual([
      { day: 3, steps: ['wake'] },
    ]);
    const old = JSON.parse(JSON.stringify(progress.toSnapshot())) as ProgressSnapshot & {
      memories?: unknown;
      decorIds?: unknown;
    };
    delete old.memories;
    delete old.decorIds;
    const loaded = PlayerProgress.fromSnapshot(old);
    expect(loaded.memories).toEqual([]);
    expect(loaded.decor).toEqual([]);
  });
});

describe('the room', () => {
  const rich = () => new InMemoryProgressRepository(PlayerProgress.createNew().rewardSession(25));

  it('is decorated with coins earned in the game', async () => {
    const progress = rich();
    const buy = new BuyDecor(progress);
    await expect(buy.execute('poster')).resolves.toBe(true);
    await expect(buy.owned()).resolves.toEqual(['poster']);
    expect((await progress.load()).coins.amount).toBe(15);
  });

  it('asks for more coins without taking any, and sells each thing once', async () => {
    const progress = rich();
    const buy = new BuyDecor(progress);
    await expect(buy.execute('stars')).resolves.toBe(false);
    expect((await progress.load()).coins.amount).toBe(25);
    await buy.execute('poster');
    await expect(buy.execute('poster')).resolves.toBe(false);
  });

  it('forgets what no longer exists in a save', () => {
    const snapshot = { ...PlayerProgress.createNew().toSnapshot(), decorIds: ['poster', 'dragon'] };
    expect(PlayerProgress.fromSnapshot(snapshot).decor).toEqual(['poster']);
    expect(isDecor('dragon')).toBe(false);
    expect(decorItems.length).toBeGreaterThan(3);
  });
});
