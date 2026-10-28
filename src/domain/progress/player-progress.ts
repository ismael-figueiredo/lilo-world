import type { WardrobeItem, WardrobeItemId, WardrobeSlot } from '@domain/avatar/wardrobe-item';
import type { Mission, MissionId } from '@domain/mission/mission';
import { Coins } from '@domain/reward/coins';
import { noReward, type Reward } from '@domain/reward/reward';
import { domainError, err, ok, type Result } from '@domain/shared/result';

/** Plain, serializable shape used to store progress on the device. */
export interface ProgressSnapshot {
  readonly coins: number;
  readonly stars: number;
  readonly ownedItemIds: readonly WardrobeItemId[];
  readonly equipped: Partial<Record<WardrobeSlot, WardrobeItemId>>;
  readonly completedMissionIds: readonly MissionId[];
}

/** Everything the child has earned so far. Immutable: every change returns a new instance. */
export class PlayerProgress {
  private constructor(
    readonly coins: Coins,
    readonly stars: number,
    private readonly ownedItemIds: ReadonlySet<WardrobeItemId>,
    readonly equipped: Readonly<Partial<Record<WardrobeSlot, WardrobeItemId>>>,
    private readonly completedMissionIds: ReadonlySet<MissionId>,
  ) {}

  static createNew(): PlayerProgress {
    return new PlayerProgress(Coins.zero, 0, new Set(), {}, new Set());
  }

  /** Rebuilds progress from stored data, discarding anything invalid instead of failing. */
  static fromSnapshot(snapshot: ProgressSnapshot): PlayerProgress {
    const coins = Coins.of(snapshot.coins);
    const stars = Number.isInteger(snapshot.stars) && snapshot.stars > 0 ? snapshot.stars : 0;
    const owned = new Set(snapshot.ownedItemIds);
    const equipped = Object.fromEntries(
      Object.entries(snapshot.equipped).filter(([, id]) => owned.has(id)),
    );
    return new PlayerProgress(
      coins.ok ? coins.value : Coins.zero,
      stars,
      owned,
      equipped,
      new Set(snapshot.completedMissionIds),
    );
  }

  toSnapshot(): ProgressSnapshot {
    return {
      coins: this.coins.amount,
      stars: this.stars,
      ownedItemIds: [...this.ownedItemIds],
      equipped: { ...this.equipped },
      completedMissionIds: [...this.completedMissionIds],
    };
  }

  owns(itemId: WardrobeItemId): boolean {
    return this.ownedItemIds.has(itemId);
  }

  hasCompleted(missionId: MissionId): boolean {
    return this.completedMissionIds.has(missionId);
  }

  /**
   * Coins are earned every time (repetition is welcome); stars only the first
   * time, so worlds unlock by learning new things.
   */
  rewardFor(mission: Mission): Reward {
    const stars = this.hasCompleted(mission.id) ? noReward.stars : mission.reward.stars;
    return { coins: mission.reward.coins, stars };
  }

  completeMission(mission: Mission): { progress: PlayerProgress; reward: Reward } {
    const reward = this.rewardFor(mission);
    const earned = Coins.of(reward.coins);
    const progress = new PlayerProgress(
      earned.ok ? this.coins.add(earned.value) : this.coins,
      this.stars + reward.stars,
      this.ownedItemIds,
      this.equipped,
      new Set([...this.completedMissionIds, mission.id]),
    );
    return { progress, reward };
  }

  buy(item: WardrobeItem): Result<PlayerProgress> {
    if (this.owns(item.id)) {
      return err(domainError('item-already-owned', `Item already owned: ${item.id}`));
    }
    const price = Coins.of(item.price);
    if (!price.ok) return price;
    const remaining = this.coins.subtract(price.value);
    if (!remaining.ok) return remaining;

    return ok(
      new PlayerProgress(
        remaining.value,
        this.stars,
        new Set([...this.ownedItemIds, item.id]),
        this.equipped,
        this.completedMissionIds,
      ),
    );
  }

  equip(item: WardrobeItem): Result<PlayerProgress> {
    if (!this.owns(item.id)) {
      return err(domainError('item-not-owned', `Item not owned: ${item.id}`));
    }
    return ok(
      new PlayerProgress(
        this.coins,
        this.stars,
        this.ownedItemIds,
        { ...this.equipped, [item.slot]: item.id },
        this.completedMissionIds,
      ),
    );
  }

  unequip(slot: WardrobeSlot): PlayerProgress {
    const equipped = Object.fromEntries(
      Object.entries(this.equipped).filter(([equippedSlot]) => equippedSlot !== slot),
    );
    return new PlayerProgress(
      this.coins,
      this.stars,
      this.ownedItemIds,
      equipped,
      this.completedMissionIds,
    );
  }
}
