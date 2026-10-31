import { describe, expect, it } from 'vitest';
import { PlayerProgress } from '@domain/progress/player-progress';
import { expensiveShirt, hat, mission, otherHat } from '../support/fixtures';

const richProgress = (): PlayerProgress =>
  PlayerProgress.fromSnapshot({
    coins: 20,
    stars: 0,
    ownedItemIds: [],
    equipped: {},
    completedMissionIds: [],
  });

describe('PlayerProgress', () => {
  it('starts empty', () => {
    const progress = PlayerProgress.createNew();
    expect(progress.coins.amount).toBe(0);
    expect(progress.stars).toBe(0);
  });

  it('gives coins and a star the first time a mission is completed', () => {
    const { progress, reward } = PlayerProgress.createNew().completeMission(mission);
    expect(reward).toEqual({ coins: 10, stars: 1 });
    expect(progress.coins.amount).toBe(10);
    expect(progress.stars).toBe(1);
    expect(progress.hasCompleted(mission.id)).toBe(true);
  });

  it('gives only coins when a mission is repeated', () => {
    const once = PlayerProgress.createNew().completeMission(mission).progress;
    const { progress, reward } = once.completeMission(mission);
    expect(reward).toEqual({ coins: 10, stars: 0 });
    expect(progress.coins.amount).toBe(20);
    expect(progress.stars).toBe(1);
  });

  it('buys an item and takes its price', () => {
    const result = richProgress().buy(hat);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.owns(hat.id)).toBe(true);
      expect(result.value.coins.amount).toBe(15);
    }
  });

  it('does not buy what it cannot afford', () => {
    const result = richProgress().buy(expensiveShirt);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not-enough-coins');
  });

  it('does not buy the same item twice', () => {
    const bought = richProgress().buy(hat);
    if (!bought.ok) throw new Error('setup failed');
    const again = bought.value.buy(hat);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('item-already-owned');
  });

  it('equips only owned items, one per slot', () => {
    expect(richProgress().equip(hat).ok).toBe(false);

    const withHats = richProgress().buy(hat);
    if (!withHats.ok) throw new Error('setup failed');
    const both = withHats.value.buy(otherHat);
    if (!both.ok) throw new Error('setup failed');

    const first = both.value.equip(hat);
    if (!first.ok) throw new Error('setup failed');
    const second = first.value.equip(otherHat);
    expect(second.ok && second.value.equipped.hat).toBe(otherHat.id);
  });

  it('unequips a slot', () => {
    const bought = richProgress().buy(hat);
    if (!bought.ok) throw new Error('setup failed');
    const worn = bought.value.equip(hat);
    if (!worn.ok) throw new Error('setup failed');
    expect(worn.value.unequip('hat').equipped.hat).toBeUndefined();
  });

  it('round-trips through a snapshot', () => {
    const bought = richProgress().buy(hat);
    if (!bought.ok) throw new Error('setup failed');
    const worn = bought.value.equip(hat);
    if (!worn.ok) throw new Error('setup failed');
    const progress = worn.value.completeMission(mission).progress;

    const restored = PlayerProgress.fromSnapshot(progress.toSnapshot());
    expect(restored.toSnapshot()).toEqual(progress.toSnapshot());
  });

  it('discards invalid stored data instead of failing', () => {
    const restored = PlayerProgress.fromSnapshot({
      coins: -5,
      stars: 1.5,
      ownedItemIds: [],
      equipped: { hat: 'not-owned' },
      completedMissionIds: [],
    });
    expect(restored.coins.amount).toBe(0);
    expect(restored.stars).toBe(0);
    expect(restored.equipped).toEqual({});
  });
});

describe('learning progress', () => {
  it('survives a save and keeps only valid letters and levels', () => {
    const progress = PlayerProgress.fromSnapshot({
      ...PlayerProgress.createNew().toSnapshot(),
      skillLevels: { letters: 3, numbers: 42 },
      stickerIds: ['letters-1'],
      letters: ['A', '7', 'B'],
    });
    const again = PlayerProgress.fromSnapshot(progress.toSnapshot());
    expect(again.levelOf('letters')).toBe(3);
    expect(again.levelOf('numbers')).toBe(3);
    expect(again.levelOf('coins')).toBe(1);
    expect(again.hasSticker('letters-1')).toBe(true);
    expect(again.letters).toEqual(['A', 'B']);
  });

  it('ignores wrong answers', () => {
    const progress = PlayerProgress.createNew();
    const { progress: same, reward } = progress.recordChallenge('numbers', { correct: false });
    expect(same).toBe(progress);
    expect(reward).toEqual({ coins: 0, stars: 0 });
  });
});
