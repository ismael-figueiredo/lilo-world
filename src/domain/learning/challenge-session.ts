import {
  createChallenge,
  MAX_LEVEL,
  type Challenge,
  type Skill,
  type Word,
} from '@domain/learning/challenge';
import { shuffled, type Random } from '@domain/shared/random';

/** New questions in a round. A round always ends, with a calm result screen. */
export const ROUND_LENGTH = 5;
/** Right on the first try, out of ROUND_LENGTH, to go up a level. */
export const SCORE_TO_LEVEL_UP = 4;
/** A missed question comes back after this many others. */
const RETRY_AFTER = 2;
/** How many past questions a new one must differ from. */
const MEMORY = 6;

export interface RoundSummary {
  readonly score: number;
  readonly total: number;
  /** The level just reached, when the round was good enough. */
  readonly reachedLevel?: number;
}

export type ChallengeOutcome =
  /** Right on the first try: this is what counts. */
  | { readonly kind: 'correct'; readonly letter?: string; readonly summary?: RoundSummary }
  /** Wrong: the game shows the right card and only that one can be pressed. */
  | { readonly kind: 'model'; readonly answerId: string }
  /** The child pressed the card that was shown, or got a missed question on its return. */
  | { readonly kind: 'practiced'; readonly letter?: string; readonly summary?: RoundSummary };

interface Retry {
  readonly challenge: Challenge;
  readonly due: number;
}

interface State {
  readonly skill: Skill;
  readonly level: number;
  readonly challenge: Challenge;
  /** New questions already answered. */
  readonly asked: number;
  readonly score: number;
  readonly mistakes: number;
  readonly modeling: boolean;
  /** This is a missed question coming back: it no longer counts for points. */
  readonly isRetry: boolean;
  readonly retries: readonly Retry[];
  readonly recent: readonly string[];
}

const keyOf = (challenge: Challenge): string => `${challenge.question}|${challenge.show}`;

/**
 * One round at a learning station. A wrong card never leaves the child picking
 * the other ones until something works: the game shows the answer, the next
 * question is a new one, and the missed question returns a little later. Only
 * first-try answers count, so guessing brings nothing. Levels never go down.
 */
export class ChallengeSession {
  private constructor(private readonly state: State) {}

  static start(
    skill: Skill,
    level: number,
    random: Random,
    words: readonly Word[],
  ): ChallengeSession {
    const safe = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);
    const challenge = createChallenge(skill, safe, random, words);
    return new ChallengeSession({
      skill,
      level: safe,
      challenge,
      asked: 0,
      score: 0,
      mistakes: 0,
      modeling: false,
      isRetry: false,
      retries: [],
      recent: [keyOf(challenge)],
    });
  }

  get skill(): Skill {
    return this.state.skill;
  }

  get level(): number {
    return this.state.level;
  }

  get challenge(): Challenge {
    return this.state.challenge;
  }

  get score(): number {
    return this.state.score;
  }

  get mistakes(): number {
    return this.state.mistakes;
  }

  /** New questions answered so far in this round. */
  get asked(): number {
    return this.state.asked;
  }

  get isRetry(): boolean {
    return this.state.isRetry;
  }

  get isModeling(): boolean {
    return this.state.modeling;
  }

  answer(
    optionId: string,
    random: Random,
    words: readonly Word[],
  ): { session: ChallengeSession; outcome: ChallengeOutcome } {
    const { challenge, modeling, isRetry } = this.state;
    const right = optionId === challenge.answerId;

    if (!right) {
      const session = new ChallengeSession({
        ...this.state,
        modeling: true,
        mistakes: this.state.mistakes + (modeling ? 0 : 1),
      });
      return { session, outcome: { kind: 'model', answerId: challenge.answerId } };
    }

    const firstTry = !modeling && !isRetry;
    const score = this.state.score + (firstTry ? 1 : 0);
    const asked = this.state.asked + (isRetry ? 0 : 1);
    // Missed for the first time: it comes back once, after other questions.
    const retries =
      modeling && !isRetry
        ? [...this.state.retries, { challenge, due: asked + RETRY_AFTER }]
        : this.state.retries;
    const letter = firstTry ? challenge.letter : undefined;
    const base = { score, asked, retries };

    const retry = retries.find((r) => r.due <= asked || asked >= ROUND_LENGTH);
    if (asked >= ROUND_LENGTH && retry === undefined) {
      const reachedLevel =
        score >= SCORE_TO_LEVEL_UP && this.state.level < MAX_LEVEL
          ? this.state.level + 1
          : undefined;
      const summary: RoundSummary = {
        score,
        total: ROUND_LENGTH,
        ...(reachedLevel === undefined ? {} : { reachedLevel }),
      };
      const session = new ChallengeSession({
        ...this.state,
        ...base,
        modeling: false,
        isRetry: false,
      });
      return { session, outcome: this.outcomeOf(firstTry, letter, summary) };
    }

    const next =
      retry === undefined
        ? this.newChallenge(random, words)
        : { ...retry.challenge, options: shuffled(random, retry.challenge.options) };
    const session = new ChallengeSession({
      ...this.state,
      ...base,
      challenge: next,
      modeling: false,
      isRetry: retry !== undefined,
      retries: retries.filter((r) => r !== retry),
      recent: [...this.state.recent, keyOf(next)].slice(-MEMORY),
    });
    return { session, outcome: this.outcomeOf(firstTry, letter, undefined) };
  }

  private outcomeOf(
    firstTry: boolean,
    letter: string | undefined,
    summary: RoundSummary | undefined,
  ): ChallengeOutcome {
    return {
      kind: firstTry ? 'correct' : 'practiced',
      ...(letter === undefined ? {} : { letter }),
      ...(summary === undefined ? {} : { summary }),
    };
  }

  /** A question different from the last ones, whenever the content allows it. */
  private newChallenge(random: Random, words: readonly Word[]): Challenge {
    const { skill, level, recent } = this.state;
    let challenge = createChallenge(skill, level, random, words);
    for (let tries = 0; tries < 12 && recent.includes(keyOf(challenge)); tries += 1) {
      challenge = createChallenge(skill, level, random, words);
    }
    return challenge;
  }
}
