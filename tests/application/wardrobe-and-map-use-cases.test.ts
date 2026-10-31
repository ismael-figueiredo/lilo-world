import { beforeEach, describe, expect, it } from 'vitest';
import { BuyWardrobeItem } from '@application/use-cases/buy-wardrobe-item';
import { GetPlayerProgress } from '@application/use-cases/get-player-progress';
import { GetWardrobe } from '@application/use-cases/get-wardrobe';
import { ToggleWardrobeItem } from '@application/use-cases/toggle-wardrobe-item';
import { PlayerProgress } from '@domain/progress/player-progress';
import { StaticContentCatalog } from '@infrastructure/catalog/static-content-catalog';
import { InMemoryProgressRepository } from '@infrastructure/persistence/in-memory-progress-repository';
import { content, expensiveShirt, hat } from '../support/fixtures';

const withCoins = (coins: number, stars = 0): InMemoryProgressRepository =>
  new InMemoryProgressRepository(
    PlayerProgress.fromSnapshot({
      coins,
      stars,
      ownedItemIds: [],
      equipped: {},
      completedMissionIds: [],
    }),
  );

describe('wardrobe use cases', () => {
  const catalog = new StaticContentCatalog(content);
  let progress: InMemoryProgressRepository;

  beforeEach(() => {
    progress = withCoins(10);
  });

  it('lists items with ownership and affordability', async () => {
    const wardrobe = await new GetWardrobe(catalog, progress).execute();
    expect(wardrobe.coins).toBe(10);
    expect(wardrobe.entries.map((e) => [e.item.id, e.owned, e.affordable])).toEqual([
      ['hat', false, true],
      ['hat-2', false, true],
      ['shirt', false, false],
    ]);
  });

  it('buys and immediately wears an item', async () => {
    const result = await new BuyWardrobeItem(catalog, progress).execute(hat.id);
    expect(result.ok).toBe(true);
    const saved = await new GetPlayerProgress(progress).execute();
    expect(saved.owns(hat.id)).toBe(true);
    expect(saved.equipped.hat).toBe(hat.id);
    expect(saved.coins.amount).toBe(5);
  });

  it('does not save when the item cannot be bought', async () => {
    const result = await new BuyWardrobeItem(catalog, progress).execute(expensiveShirt.id);
    expect(result.ok).toBe(false);
    expect((await progress.load()).coins.amount).toBe(10);
  });

  it('reports unknown items', async () => {
    const buy = await new BuyWardrobeItem(catalog, progress).execute('missing');
    const toggle = await new ToggleWardrobeItem(catalog, progress).execute('missing');
    expect(buy.ok || toggle.ok).toBe(false);
  });

  it('toggles an owned item off and on again', async () => {
    await new BuyWardrobeItem(catalog, progress).execute(hat.id);
    const toggle = new ToggleWardrobeItem(catalog, progress);

    await toggle.execute(hat.id);
    expect((await progress.load()).equipped.hat).toBeUndefined();

    await toggle.execute(hat.id);
    expect((await progress.load()).equipped.hat).toBe(hat.id);
  });

  it('cannot wear an item that is not owned', async () => {
    const result = await new ToggleWardrobeItem(catalog, progress).execute(hat.id);
    expect(result.ok).toBe(false);
  });
});
