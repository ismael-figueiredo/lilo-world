import {
  createChallenge,
  MAX_LEVEL,
  type Challenge,
  type Skill,
  type Word,
} from '@domain/learning/challenge';
import type { HintLevel } from '@domain/mission/mission-attempt';
import { MAX_HINT_LEVEL } from '@domain/mission/mission-attempt';
import type { Random } from '@domain/shared/random';

/** Right answers in a row needed to go up a level. */
export const STREAK_TO_LEVEL_UP = 3;

export type ChallengeOutcome =
  | {
      readonly kind: 'correct';
      /** The level just reached, when this answer completed a streak. */
      readonly reachedLevel?: number;
      readonly letter?: string;
    }
  | { readonly kind: 'hint'; readonly hintLevel: HintLevel };

/**
 * A run of challenges at a learning station. Hints work like in missions.
 * Going up is earned with a streak; a mistake never sends the child down a
 * level, it only starts the streak again with a clearer hint.
 */
export class ChallengeSession {
  private constructor(
    readonly skill: Skill,
    readonly level: number,
    readonly streak: number,
    readonly hintLevel: HintLevel,
    readonly mistakes: number,
    readonly challenge: Challenge,
  ) {}

  static start(
    skill: Skill,
    level: number,
    random: Random,
    words: readonly Word[],
  ): ChallengeSession {
    const safe = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);
    return new ChallengeSession(skill, safe, 0, 0, 0, createChallenge(skill, safe, random, words));
  }

  /** At the top level the child keeps practicing, without more level ups. */
  get isAtTop(): boolean {
    return this.level >= MAX_LEVEL;
  }

  answer(
    optionId: string,
    random: Random,
    words: readonly Word[],
  ): { session: ChallengeSession; outcome: ChallengeOutcome } {
    if (optionId !== this.challenge.answerId) {
      const hintLevel = Math.min(this.hintLevel + 1, MAX_HINT_LEVEL) as HintLevel;
      return {
        session: new ChallengeSession(
          this.skill,
          this.level,
          0,
          hintLevel,
          this.mistakes + 1,
          this.challenge,
        ),
        outcome: { kind: 'hint', hintLevel },
      };
    }

    const streak = this.streak + 1;
    const levelUp = streak >= STREAK_TO_LEVEL_UP && !this.isAtTop;
    const level = levelUp ? this.level + 1 : this.level;
    const next = createChallenge(this.skill, level, random, words);
    const letter = this.challenge.letter;
    return {
      session: new ChallengeSession(
        this.skill,
        level,
        levelUp ? 0 : streak,
        0,
        this.mistakes,
        next,
      ),
      outcome: {
        kind: 'correct',
        ...(levelUp ? { reachedLevel: level } : {}),
        ...(letter === undefined ? {} : { letter }),
      },
    };
  }
}
