import type { WardrobeItem, WardrobeItemId, WardrobeSlot } from '@domain/avatar/wardrobe-item';
import { MAX_LEVEL, skills, type Skill } from '@domain/learning/challenge';
import type { Mission, MissionId } from '@domain/mission/mission';
import { Coins } from '@domain/reward/coins';
import { noReward, type Reward } from '@domain/reward/reward';
import { domainError, err, ok, type Result } from '@domain/shared/result';
import { ALBUM_LETTERS, stickerId, type StickerId } from '@domain/stickers/sticker';

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
  /** Level reached in each learning skill (1 when never played). */
  readonly skillLevels?: Readonly<Partial<Record<Skill, number>>>;
  readonly stickerIds?: readonly StickerId[];
  /** Letters collected for the alphabet album. */
  readonly letters?: readonly string[];
}

/** One answer at a learning station. */
export interface ChallengeRecord {
  readonly correct: boolean;
  /** The level reached with this answer, if it completed a streak. */
  readonly reachedLevel?: number;
  /** A letter learned with this answer (first-letter challenges). */
  readonly letter?: string;
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
  readonly skillLevels: Readonly<Record<Skill, number>>;
  readonly stickers: ReadonlySet<StickerId>;
  readonly letters: ReadonlySet<string>;
}

const startingLevels = (): Record<Skill, number> =>
  Object.fromEntries(skills.map((skill) => [skill, 1])) as Record<Skill, number>;

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
      skillLevels: startingLevels(),
      stickers: new Set(),
      letters: new Set(),
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
    const skillLevels = startingLevels();
    for (const skill of skills) {
      const level = wholeNumber(snapshot.skillLevels?.[skill]);
      skillLevels[skill] = Math.min(Math.max(1, level), MAX_LEVEL);
    }
    return new PlayerProgress({
      coins: coins.ok ? coins.value : Coins.zero,
      stars: wholeNumber(snapshot.stars),
      owned,
      equipped,
      completed: new Set(snapshot.completedMissionIds),
      stats,
      skillLevels,
      stickers: new Set(snapshot.stickerIds ?? []),
      letters: new Set((snapshot.letters ?? []).filter((l) => ALBUM_LETTERS.includes(l))),
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
      skillLevels: { ...this.state.skillLevels },
      stickerIds: [...this.state.stickers],
      letters: [...this.state.letters],
    };
  }

  levelOf(skill: Skill): number {
    return this.state.skillLevels[skill];
  }

  hasSticker(id: StickerId): boolean {
    return this.state.stickers.has(id);
  }

  get stickerIds(): readonly StickerId[] {
    return [...this.state.stickers];
  }

  get letters(): readonly string[] {
    return [...this.state.letters];
  }

  /**
   * One answer at a learning station. Every right answer gives a coin. The
   * first right answer of a skill and every new level give a sticker and a
   * star (once each). Wrong answers change nothing: they only bring a hint.
   */
  recordChallenge(
    skill: Skill,
    record: ChallengeRecord,
  ): { progress: PlayerProgress; reward: Reward; sticker?: StickerId } {
    if (!record.correct) return { progress: this, reward: noReward };

    const level = Math.min(
      Math.max(this.levelOf(skill), wholeNumber(record.reachedLevel)),
      MAX_LEVEL,
    );
    const candidate = stickerId(skill, record.reachedLevel === undefined ? 1 : level);
    const sticker = this.hasSticker(candidate) ? undefined : candidate;
    const reward: Reward = { coins: 1, stars: sticker === undefined ? 0 : 1 };
    const earned = Coins.of(reward.coins);
    const letter = record.letter?.toUpperCase();
    const progress = this.with({
      coins: earned.ok ? this.state.coins.add(earned.value) : this.state.coins,
      stars: this.state.stars + reward.stars,
      skillLevels: { ...this.state.skillLevels, [skill]: level },
      stickers:
        sticker === undefined ? this.state.stickers : new Set([...this.state.stickers, sticker]),
      letters:
        letter !== undefined && ALBUM_LETTERS.includes(letter)
          ? new Set([...this.state.letters, letter])
          : this.state.letters,
    });
    return sticker === undefined ? { progress, reward } : { progress, reward, sticker };
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

  /** A small prize for doing something well outside a mission. */
  earnCoins(amount: number): PlayerProgress {
    const earned = Coins.of(amount);
    return earned.ok ? this.with({ coins: this.state.coins.add(earned.value) }) : this;
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
