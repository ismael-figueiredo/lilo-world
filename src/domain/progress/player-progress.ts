import type { WardrobeItem, WardrobeItemId, WardrobeSlot } from '@domain/avatar/wardrobe-item';
import type { Mission, MissionId } from '@domain/mission/mission';
import { Coins } from '@domain/reward/coins';
import { noReward, type Reward } from '@domain/reward/reward';
import { domainError, err, ok, type Result } from '@domain/shared/result';

/** How a mission has gone so far. Used by the progress screen (and later by therapists). */
export interface MissionStats {
  readonly attempts: number;
  readonly completions: number;
  readonly mistakes: number;
  /** Epoch milliseconds, 0 when never played. */
  readonly lastPlayedAt: number;
}

export const emptyStats: MissionStats = {
  attempts: 0,
  completions: 0,
  mistakes: 0,
  lastPlayedAt: 0,
};

/** Plain, serializable shape used to store progress on the device. */
export interface ProgressSnapshot {
  readonly coins: number;
  readonly stars: number;
  readonly ownedItemIds: readonly WardrobeItemId[];
  readonly equipped: Partial<Record<WardrobeSlot, WardrobeItemId>>;
  readonly completedMissionIds: readonly MissionId[];
  readonly missionStats?: Readonly<Record<MissionId, MissionStats>>;
}

/** The result of one play of a mission. */
export interface AttemptRecord {
  readonly mistakes: number;
  readonly at: number;
}

interface State {
  readonly coins: Coins;
  readonly stars: number;
  readonly owned: ReadonlySet<WardrobeItemId>;
  readonly equipped: Readonly<Partial<Record<WardrobeSlot, WardrobeItemId>>>;
  readonly completed: ReadonlySet<MissionId>;
  readonly stats: Readonly<Record<MissionId, MissionStats>>;
}

const wholeNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;

/** Everything the child has earned so far. Immutable: every change returns a new instance. */
export class PlayerProgress {
  private constructor(private readonly state: State) {}

  static createNew(): PlayerProgress {
    return new PlayerProgress({
      coins: Coins.zero,
      stars: 0,
      owned: new Set(),
      equipped: {},
      completed: new Set(),
      stats: {},
    });
  }

  /** Rebuilds progress from stored data, discarding anything invalid instead of failing. */
  static fromSnapshot(snapshot: ProgressSnapshot): PlayerProgress {
    const coins = Coins.of(snapshot.coins);
    const owned = new Set(snapshot.ownedItemIds);
    const equipped = Object.fromEntries(
      Object.entries(snapshot.equipped).filter(([, id]) => owned.has(id)),
    );
    const stats = Object.fromEntries(
      Object.entries(snapshot.missionStats ?? {}).map(([id, s]) => [
        id,
        {
          attempts: wholeNumber(s.attempts),
          completions: wholeNumber(s.completions),
          mistakes: wholeNumber(s.mistakes),
          lastPlayedAt: wholeNumber(s.lastPlayedAt),
        },
      ]),
    );
    return new PlayerProgress({
      coins: coins.ok ? coins.value : Coins.zero,
      stars: wholeNumber(snapshot.stars),
      owned,
      equipped,
      completed: new Set(snapshot.completedMissionIds),
      stats,
    });
  }

  toSnapshot(): ProgressSnapshot {
    return {
      coins: this.state.coins.amount,
      stars: this.state.stars,
      ownedItemIds: [...this.state.owned],
      equipped: { ...this.state.equipped },
      completedMissionIds: [...this.state.completed],
      missionStats: { ...this.state.stats },
    };
  }

  get coins(): Coins {
    return this.state.coins;
  }

  get stars(): number {
    return this.state.stars;
  }

  get equipped(): Readonly<Partial<Record<WardrobeSlot, WardrobeItemId>>> {
    return this.state.equipped;
  }

  get ownedCount(): number {
    return this.state.owned.size;
  }

  owns(itemId: WardrobeItemId): boolean {
    return this.state.owned.has(itemId);
  }

  hasCompleted(missionId: MissionId): boolean {
    return this.state.completed.has(missionId);
  }

  statsFor(missionId: MissionId): MissionStats {
    return this.state.stats[missionId] ?? emptyStats;
  }

  /**
   * Coins are earned every time (repetition is welcome); stars only the first
   * time, so worlds unlock by learning new things.
   */
  rewardFor(mission: Mission): Reward {
    const stars = this.hasCompleted(mission.id) ? noReward.stars : mission.reward.stars;
    return { coins: mission.reward.coins, stars };
  }

  completeMission(
    mission: Mission,
    record: AttemptRecord = { mistakes: 0, at: 0 },
  ): { progress: PlayerProgress; reward: Reward } {
    const reward = this.rewardFor(mission);
    const earned = Coins.of(reward.coins);
    const progress = this.with({
      coins: earned.ok ? this.state.coins.add(earned.value) : this.state.coins,
      stars: this.state.stars + reward.stars,
      completed: new Set([...this.state.completed, mission.id]),
      stats: this.addStats(mission.id, record, true),
    });
    return { progress, reward };
  }

  /** A mission left before the end still counts as practice, never as a failure. */
  recordAttempt(missionId: MissionId, record: AttemptRecord): PlayerProgress {
    return this.with({ stats: this.addStats(missionId, record, false) });
  }

  buy(item: WardrobeItem): Result<PlayerProgress> {
    if (this.owns(item.id)) {
      return err(domainError('item-already-owned', `Item already owned: ${item.id}`));
    }
    const price = Coins.of(item.price);
    if (!price.ok) return price;
    const remaining = this.state.coins.subtract(price.value);
    if (!remaining.ok) return remaining;
    return ok(
      this.with({ coins: remaining.value, owned: new Set([...this.state.owned, item.id]) }),
    );
  }

  equip(item: WardrobeItem): Result<PlayerProgress> {
    if (!this.owns(item.id)) {
      return err(domainError('item-not-owned', `Item not owned: ${item.id}`));
    }
    return ok(this.with({ equipped: { ...this.state.equipped, [item.slot]: item.id } }));
  }

  unequip(slot: WardrobeSlot): PlayerProgress {
    const equipped = Object.fromEntries(
      Object.entries(this.state.equipped).filter(([equippedSlot]) => equippedSlot !== slot),
    );
    return this.with({ equipped });
  }

  private with(changes: Partial<State>): PlayerProgress {
    return new PlayerProgress({ ...this.state, ...changes });
  }

  private addStats(
    missionId: MissionId,
    record: AttemptRecord,
    completed: boolean,
  ): Record<MissionId, MissionStats> {
    const current = this.statsFor(missionId);
    return {
      ...this.state.stats,
      [missionId]: {
        attempts: current.attempts + 1,
        completions: current.completions + (completed ? 1 : 0),
        mistakes: current.mistakes + Math.max(0, Math.floor(record.mistakes)),
        lastPlayedAt: Math.max(current.lastPlayedAt, Math.floor(record.at)),
      },
    };
  }
}
