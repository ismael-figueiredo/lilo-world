import type { Word } from '@domain/language/word';
import { shuffled, type Random } from '@domain/shared/random';

/** What the game says. `clip` is a recorded file; sounds alone can only come from one. */
export interface Spoken {
  readonly text: string;
  readonly clip?: string;
  /** Put on screen instead of `text`, when writing it would give the answer away. */
  readonly written?: string;
  /** Only the voice can ask this: with the voice off the whole text must be written. */
  readonly needsVoice?: boolean;
}

/** What to write for something said. Heard and read must never give the answer together. */
export const writtenOf = (spoken: Spoken, voiceEnabled: boolean): string =>
  spoken.written === undefined || (spoken.needsVoice === true && !voiceEnabled)
    ? spoken.text
    : spoken.written;

/** Things that exist in 3D on the study desk. */
export type DeskThing = 'apple' | 'star' | 'fish' | 'flower' | 'car' | 'balloon' | 'coin';

/** Same shape as a mission card: the pictogram when there is one, otherwise the emoji. */
export interface Picture {
  readonly pictogram: string;
  readonly image?: string;
  /** The real object, when the desk has one. */
  readonly thing?: DeskThing;
}

/** What is shown big above the answers. */
export type Stimulus =
  | { readonly kind: 'none' }
  | { readonly kind: 'picture'; readonly picture: Picture }
  /** Written on the board. `_` is the part to complete. */
  | { readonly kind: 'word'; readonly text: string; readonly picture?: Picture }
  /** Things to count, in groups that are easy to see. */
  | { readonly kind: 'objects'; readonly picture: Picture; readonly groups: readonly number[] }
  | { readonly kind: 'sum'; readonly picture: Picture; readonly a: number; readonly b: number }
  /** Two plates side by side, the blue and the red one. */
  | { readonly kind: 'compare'; readonly picture: Picture; readonly a: number; readonly b: number }
  /** `a` things, and `b` of them go away. */
  | { readonly kind: 'minus'; readonly picture: Picture; readonly a: number; readonly b: number }
  | { readonly kind: 'clock'; readonly hour: number }
  /** Toy money on the desk, by value. */
  | { readonly kind: 'cash'; readonly values: readonly number[] }
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
    }
  /** Put the pieces in order: syllables, a sentence, how a plant grows. */
  | {
      readonly kind: 'order';
      readonly pieces: readonly ActivityOption[];
      readonly answer: readonly string[];
    }
  /** Link each one on the left to its pair on the right. */
  | {
      readonly kind: 'match';
      readonly left: readonly ActivityOption[];
      readonly right: readonly ActivityOption[];
      /** Left id, right id. */
      readonly pairs: readonly (readonly [string, string])[];
    }
  /** Put each piece in its group. */
  | {
      readonly kind: 'sort';
      readonly pieces: readonly ActivityOption[];
      readonly groups: readonly ActivityOption[];
      /** Piece id, group id. */
      readonly places: readonly (readonly [string, string])[];
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
  /** How far the round has gone, 0 to 1. Without it, the whole range is used. */
  readonly progress?: number;
}

/** Makes a new item for a skill. Pure: same random, same item. */
export type ActivityBuilder = (context: ActivityContext) => Omit<ActivityItem, 'skillId'>;

/** Pieces in random order, never already solved. */
export function scrambled(
  random: Random,
  pieces: readonly ActivityOption[],
  answer: readonly string[],
): ActivityOption[] {
  const mixed = shuffled(random, pieces);
  if (mixed.some((piece, index) => piece.id !== answer[index])) return mixed;
  return [...mixed.slice(1), ...mixed.slice(0, 1)];
}

/** How an order is answered: the ids, one after the other. */
export const orderAnswer = (ids: readonly string[]): string => ids.join('>');

/** How links are answered, whatever order they were made in. */
export const linksAnswer = (links: readonly (readonly [string, string])[]): string =>
  links
    .map(([from, to]) => `${from}=${to}`)
    .sort()
    .join(',');

/** The right answer of any interaction. A drag is answered by how many pieces were carried. */
export function answerOf(interaction: Interaction): string {
  switch (interaction.kind) {
    case 'tap':
      return interaction.answerId;
    case 'drag':
      return String(interaction.goal);
    case 'order':
      return orderAnswer(interaction.answer);
    case 'match':
      return linksAnswer(interaction.pairs);
    case 'sort':
      return linksAnswer(interaction.places);
  }
}
