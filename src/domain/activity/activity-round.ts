import {
  answerOf,
  type ActivityContext,
  type ActivityItem,
  type Interaction,
} from '@domain/activity/activity';
import { MAX_LEVEL, type SkillDefinition, type Station } from '@domain/curriculum/skill';
import { pick, shuffled } from '@domain/shared/random';

/** New questions in a station round. A round always ends, with a calm result screen. */
export const ROUND_LENGTH = 5;
/** Right on the first try, as a share of the round, to go up a level. */
const LEVEL_UP_RATE = 0.8;
/** A missed question comes back after this many others. */
const RETRY_AFTER = 2;
/** How many past questions a new one must differ from. */
const MEMORY = 6;

export interface RoundSummary {
  readonly score: number;
  readonly total: number;
  /** The level just reached, when the round was good enough. */
  readonly reachedLevel?: number;
  /** Ended early because it was hard today. Never told to the child as a failure. */
  readonly shortened?: boolean;
}

export type ActivityOutcome =
  /** Right on the first try: this is what counts. */
  | { readonly kind: 'correct'; readonly letter?: string; readonly summary?: RoundSummary }
  /** Wrong: the game shows the right answer and only that can be pressed. */
  | { readonly kind: 'model'; readonly answerId: string }
  /** The child pressed what was shown, or got a missed question on its return. */
  | { readonly kind: 'practiced'; readonly letter?: string; readonly summary?: RoundSummary };

export interface RoundConfig {
  readonly station: Station;
  readonly level: number;
  /** Mixed in the round: more than one keeps it from feeling the same. */
  readonly skills: readonly SkillDefinition[];
  readonly length?: number;
  /** After this many mistakes the round ends gently. */
  readonly maxMistakes?: number;
}

interface Retry {
  readonly item: ActivityItem;
  readonly due: number;
}

interface State {
  readonly config: RoundConfig;
  readonly length: number;
  readonly item: ActivityItem;
  /** New questions already answered. */
  readonly asked: number;
  readonly score: number;
  readonly mistakes: number;
  readonly modeling: boolean;
  /** This model came from a mistake, not from a demonstration. */
  readonly missed: boolean;
  /** This is a missed question coming back: it no longer counts for points. */
  readonly isRetry: boolean;
  readonly retries: readonly Retry[];
  readonly recent: readonly string[];
}

const keyOf = (item: ActivityItem): string =>
  `${item.prompt.text}|${JSON.stringify(item.stimulus)}`;

const reshuffled = (interaction: Interaction, context: ActivityContext): Interaction =>
  interaction.kind === 'tap'
    ? { ...interaction, options: shuffled(context.random, interaction.options) }
    : interaction;

const newItem = (config: RoundConfig, context: ActivityContext): ActivityItem => {
  const skill = pick(context.random, config.skills);
  return { ...skill.activity(context), skillId: skill.id };
};

const progressOf = (asked: number, length: number): number =>
  length > 1 ? Math.min(asked / (length - 1), 1) : 1;

/**
 * One round of questions. A wrong answer never leaves the child trying the
 * others until something works: the game shows the answer, the next question
 * is a new one, and the missed question returns a little later. Only first-try
 * answers count, so guessing brings nothing. Levels never go down.
 */
export class ActivityRound {
  private constructor(private readonly state: State) {}

  static start(config: RoundConfig, context: ActivityContext): ActivityRound {
    const safeConfig = {
      ...config,
      level: Math.min(Math.max(1, Math.floor(config.level)), MAX_LEVEL),
    };
    const length = config.length ?? ROUND_LENGTH;
    const item = newItem(safeConfig, { ...context, progress: progressOf(0, length) });
    return new ActivityRound({
      config: safeConfig,
      length,
      item,
      asked: 0,
      score: 0,
      mistakes: 0,
      modeling: false,
      missed: false,
      isRetry: false,
      retries: [],
      recent: [keyOf(item)],
    });
  }

  get station(): Station {
    return this.state.config.station;
  }

  get level(): number {
    return this.state.config.level;
  }

  get item(): ActivityItem {
    return this.state.item;
  }

  get length(): number {
    return this.state.length;
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

  /** The child is following a demonstration: this answer says nothing about the skill. */
  get isDemonstration(): boolean {
    return this.state.modeling && !this.state.missed;
  }

  /** The game shows how it is done. It is not a mistake: nothing is counted against the child. */
  demonstrate(): ActivityRound {
    return new ActivityRound({ ...this.state, modeling: true });
  }

  answer(
    answerId: string,
    context: ActivityContext,
  ): { round: ActivityRound; outcome: ActivityOutcome } {
    const { item, modeling, missed, isRetry, config, length } = this.state;
    const right = answerId === answerOf(item.interaction);

    if (!right) {
      const round = new ActivityRound({
        ...this.state,
        modeling: true,
        missed: true,
        mistakes: this.state.mistakes + (modeling ? 0 : 1),
      });
      return { round, outcome: { kind: 'model', answerId: answerOf(item.interaction) } };
    }

    const firstTry = !modeling && !isRetry;
    const score = this.state.score + (firstTry ? 1 : 0);
    const asked = this.state.asked + (isRetry ? 0 : 1);
    // Missed for the first time: it comes back once, after other questions.
    const retries =
      missed && !isRetry
        ? [...this.state.retries, { item, due: asked + RETRY_AFTER }]
        : this.state.retries;
    const letter = firstTry ? item.letter : undefined;
    const base = { score, asked, retries };

    const tired = config.maxMistakes !== undefined && this.state.mistakes >= config.maxMistakes;
    const retry = tired ? undefined : retries.find((r) => r.due <= asked || asked >= length);
    if (tired || (asked >= length && retry === undefined)) {
      const reachedLevel =
        !tired && score >= Math.ceil(length * LEVEL_UP_RATE) && config.level < MAX_LEVEL
          ? config.level + 1
          : undefined;
      const summary: RoundSummary = {
        score,
        total: length,
        ...(reachedLevel === undefined ? {} : { reachedLevel }),
        ...(tired ? { shortened: true } : {}),
      };
      const round = new ActivityRound({
        ...this.state,
        ...base,
        modeling: false,
        missed: false,
        isRetry: false,
      });
      return { round, outcome: this.outcomeOf(firstTry, letter, summary) };
    }

    const next =
      retry === undefined
        ? this.newQuestion({ ...context, progress: progressOf(asked, length) })
        : { ...retry.item, interaction: reshuffled(retry.item.interaction, context) };
    const round = new ActivityRound({
      ...this.state,
      ...base,
      item: next,
      modeling: false,
      missed: false,
      isRetry: retry !== undefined,
      retries: retries.filter((r) => r !== retry),
      recent: [...this.state.recent, keyOf(next)].slice(-MEMORY),
    });
    return { round, outcome: this.outcomeOf(firstTry, letter, undefined) };
  }

  private outcomeOf(
    firstTry: boolean,
    letter: string | undefined,
    summary: RoundSummary | undefined,
  ): ActivityOutcome {
    return {
      kind: firstTry ? 'correct' : 'practiced',
      ...(letter === undefined ? {} : { letter }),
      ...(summary === undefined ? {} : { summary }),
    };
  }

  /** A question unlike the last ones, with a new answer, whenever the content allows it. */
  private newQuestion(context: ActivityContext): ActivityItem {
    const { config, recent, item: last } = this.state;
    const lastAnswer = answerOf(last.interaction);
    const isNew = (candidate: ActivityItem) =>
      !recent.includes(keyOf(candidate)) && answerOf(candidate.interaction) !== lastAnswer;
    let item = newItem(config, context);
    for (let tries = 0; tries < 12 && !isNew(item); tries += 1) {
      item = newItem(config, context);
    }
    return item;
  }
}
