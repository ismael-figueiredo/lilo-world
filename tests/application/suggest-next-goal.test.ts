import { describe, expect, it } from 'vitest';
import { SuggestNextGoal } from '@application/use-cases/suggest-next-goal';
import { PlayerProgress } from '@domain/progress/player-progress';
import { StaticContentCatalog } from '@infrastructure/catalog/static-content-catalog';
import { InMemoryProgressRepository } from '@infrastructure/persistence/in-memory-progress-repository';
import { content, hat, mission } from '../support/fixtures';

const suggest = (snapshot: Partial<Parameters<typeof PlayerProgress.fromSnapshot>[0]>) =>
  new SuggestNextGoal(
    new StaticContentCatalog(content),
    new InMemoryProgressRepository(
      PlayerProgress.fromSnapshot({
        coins: 0,
        stars: 0,
        ownedItemIds: [],
        equipped: {},
        completedMissionIds: [],
        ...snapshot,
      }),
    ),
  ).execute();

describe('SuggestNextGoal', () => {
  it('suggests a new mission first', async () => {
    expect(await suggest({ coins: 50 })).toEqual({
      kind: 'mission',
      missionId: mission.id,
      isNew: true,
    });
  });

  it('suggests the cheapest affordable item once missions are done', async () => {
    expect(await suggest({ coins: 10, completedMissionIds: [mission.id] })).toEqual({
      kind: 'wardrobe',
      itemId: hat.id,
    });
  });

  it('suggests replaying a mission to earn more coins', async () => {
    expect(await suggest({ coins: 1, completedMissionIds: [mission.id] })).toEqual({
      kind: 'mission',
      missionId: mission.id,
      isNew: false,
    });
  });

  it('suggests exploring when there is nothing else to do', async () => {
    const goal = await new SuggestNextGoal(
      new StaticContentCatalog({ ...content, worlds: [] }),
      new InMemoryProgressRepository(),
    ).execute();
    expect(goal).toEqual({ kind: 'explore' });
  });
});
