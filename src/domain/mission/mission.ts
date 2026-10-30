import type { Reward } from '@domain/reward/reward';
import type { WorldId } from '@domain/world/world';

export type MissionId = string;

/** Something the child can see and touch in a mission (a fruit on a shelf, a bus button...). */
export interface MissionChoice {
  readonly id: string;
  readonly label: string;
  /** Provisional pictogram (emoji) until ARASAAC pictograms are added. */
  readonly pictogram: string;
  /**
   * Choices are shown in groups, one group at a time: the one of the current
   * step (e.g. the shelf, then the cashier). Without a group, the main one.
   */
  readonly group?: string;
}

/** One instruction at a time: the mascot asks for a single target. */
export interface MissionStep {
  readonly targetId: string;
  readonly prompt: string;
  /** Other right answers: when the child chooses (any snack is a good request). */
  readonly accepts?: readonly string[];
  /** Shown big above the cards while this step is asked (a sound "Muuu!", a thing to sort). */
  readonly show?: string;
}

/**
 * How the mission is shown. The rules are the same for all (one target per
 * step, hints that get clearer); only the presentation changes.
 * - pick-items: a shopping list and a shelf (the list shows what to pick).
 * - build-sentence: AAC cards that form a sentence, e.g. [eu quero] + [pão].
 * - sequence: put the steps of a routine in order.
 * - quiz: one question per step; the answers are hidden until found.
 * - world-task: act in the 3D world (the game reports each step as it happens).
 */
export type MissionKind = 'pick-items' | 'build-sentence' | 'sequence' | 'quiz' | 'world-task';

/** One version of a mission (a recipe to shop for, a snack to ask for). */
export interface MissionVariant {
  readonly id: string;
  readonly title?: string;
  readonly introduction: string;
  readonly steps: readonly MissionStep[];
  readonly farewell?: string;
  /** Picture of what was made or bought, shown in the celebration (e.g. 🎂). */
  readonly result?: string;
}

export interface Mission {
  readonly id: MissionId;
  readonly kind: MissionKind;
  readonly worldId: WorldId;
  readonly title: string;
  readonly introduction: string;
  readonly choices: readonly MissionChoice[];
  readonly steps: readonly MissionStep[];
  readonly reward: Reward;
  /** Said by someone in the scene when the mission ends (e.g. the cashier's "Obrigado!"). */
  readonly farewell?: string;
  readonly result?: string;
  /** Each play picks one of these, so the mission is not always the same. */
  readonly variants?: readonly MissionVariant[];
  /**
   * How many other cards join the right ones on the main shelf, picked at
   * random each play. Without it, every choice is shown.
   */
  readonly distractors?: number;
}
