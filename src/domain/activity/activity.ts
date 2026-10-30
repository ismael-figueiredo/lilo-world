import type { Word } from '@domain/language/word';
import type { Random } from '@domain/shared/random';

/** What the game says. `clip` is a recorded file; sounds alone can only come from one. */
export interface Spoken {
  readonly text: string;
  readonly clip?: string;
}

/** Same shape as a mission card: the pictogram when there is one, otherwise the emoji. */
export interface Picture {
  readonly pictogram: string;
  readonly image?: string;
}

/** What is shown big above the answers. */
export type Stimulus =
  | { readonly kind: 'none' }
  | { readonly kind: 'picture'; readonly picture: Picture }
  | { readonly kind: 'word'; readonly text: string }
  /** Things to count, in groups that are easy to see. */
  | { readonly kind: 'objects'; readonly picture: Picture; readonly groups: readonly number[] }
  | { readonly kind: 'sum'; readonly picture: Picture; readonly a: number; readonly b: number }
  | { readonly kind: 'price'; readonly picture: Picture; readonly price: number };

export interface ActivityOption {
  readonly id: string;
  /** For screen readers; never shown, or it would give the answer. */
  readonly label: string;
  readonly text?: string;
  readonly picture?: Picture;
}

/** How the child answers. Each kind is one component in the interface. */
export type Interaction =
  | {
      readonly kind: 'tap';
      readonly options: readonly ActivityOption[];
      readonly answerId: string;
    }
  /** Carry `goal` pieces out of `supply` to the target, then confirm. */
  | {
      readonly kind: 'drag';
      readonly piece: Picture;
      readonly supply: number;
      readonly goal: number;
      /** Where the pieces go: a basket, the cashier. */
      readonly target: string;
    };

export type InteractionKind = Interaction['kind'];

/** One question. The same shape for every skill, so a new skill needs no new screen. */
export interface ActivityItem {
  readonly skillId: string;
  readonly prompt: Spoken;
  readonly stimulus: Stimulus;
  readonly interaction: Interaction;
  /** Said when the answer is shown: it teaches, it does not scold. */
  readonly teach: Spoken;
  /** A letter the child collects for the alphabet album when this is solved. */
  readonly letter?: string;
}

export interface ActivityContext {
  readonly random: Random;
  readonly words: readonly Word[];
}

/** Makes a new item for a skill. Pure: same random, same item. */
export type ActivityBuilder = (context: ActivityContext) => Omit<ActivityItem, 'skillId'>;

/** The right answer of any interaction. A drag is answered by how many pieces were carried. */
export const answerOf = (interaction: Interaction): string =>
  interaction.kind === 'tap' ? interaction.answerId : String(interaction.goal);
