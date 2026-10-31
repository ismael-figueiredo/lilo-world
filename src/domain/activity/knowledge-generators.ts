import {
  scrambled,
  type ActivityBuilder,
  type ActivityOption,
  type Picture,
} from '@domain/activity/activity';
import { pick, shuffled } from '@domain/shared/random';

/** Something to show as an answer: its picture, or its name when words are the point. */
export interface Card {
  readonly name: string;
  readonly pictogram?: string;
  /** Written instead of a picture. */
  readonly word?: boolean;
}

export interface Fact {
  readonly question: string;
  readonly answer: Card;
  readonly wrong: readonly Card[];
  /** Says the answer and a little more. */
  readonly teach: string;
  readonly about?: Picture;
}

export interface Sequence {
  readonly prompt: string;
  readonly steps: readonly Card[];
  readonly teach: string;
}

export interface Pairing {
  readonly prompt: string;
  readonly pairs: readonly (readonly [Card, Card])[];
  readonly teach: string;
}

export interface Sorting {
  readonly prompt: string;
  readonly groups: readonly { readonly group: Card; readonly members: readonly Card[] }[];
  readonly teach: string;
}

const optionOf = (card: Card): ActivityOption =>
  card.pictogram === undefined || card.word === true
    ? { id: card.name, label: card.name, text: card.name }
    : { id: card.name, label: card.name, picture: { pictogram: card.pictogram } };

export const askFact =
  ({ facts }: { facts: readonly Fact[] }): ActivityBuilder =>
  ({ random }) => {
    const fact = pick(random, facts);
    return {
      prompt: { text: fact.question },
      stimulus:
        fact.about === undefined ? { kind: 'none' } : { kind: 'picture', picture: fact.about },
      interaction: {
        kind: 'tap',
        options: shuffled(random, [fact.answer, ...fact.wrong]).map(optionOf),
        answerId: fact.answer.name,
      },
      teach: { text: fact.teach },
    };
  };

export const orderSteps =
  ({ sequences }: { sequences: readonly Sequence[] }): ActivityBuilder =>
  ({ random }) => {
    const sequence = pick(random, sequences);
    const pieces = sequence.steps.map(optionOf);
    const answer = pieces.map((piece) => piece.id);
    return {
      prompt: { text: sequence.prompt },
      stimulus: { kind: 'none' },
      interaction: { kind: 'order', pieces: scrambled(random, pieces, answer), answer },
      teach: { text: sequence.teach },
    };
  };

export const matchPairs =
  ({ pairings, count }: { pairings: readonly Pairing[]; count: number }): ActivityBuilder =>
  ({ random }) => {
    const pairing = pick(random, pairings);
    const pairs = shuffled(random, pairing.pairs).slice(0, count);
    return {
      prompt: { text: pairing.prompt },
      stimulus: { kind: 'none' },
      interaction: {
        kind: 'match',
        left: pairs.map(([from]) => optionOf(from)),
        right: shuffled(
          random,
          pairs.map(([, to]) => optionOf(to)),
        ),
        pairs: pairs.map(([from, to]) => [from.name, to.name]),
      },
      teach: { text: pairing.teach },
    };
  };

export const sortIntoGroups =
  ({ sortings, each }: { sortings: readonly Sorting[]; each: number }): ActivityBuilder =>
  ({ random }) => {
    const sorting = pick(random, sortings);
    const chosen = sorting.groups.map(({ group, members }) => ({
      group,
      members: shuffled(random, members).slice(0, each),
    }));
    return {
      prompt: { text: sorting.prompt },
      stimulus: { kind: 'none' },
      interaction: {
        kind: 'sort',
        pieces: shuffled(
          random,
          chosen.flatMap(({ members }) => members.map(optionOf)),
        ),
        groups: chosen.map(({ group }) => optionOf(group)),
        places: chosen.flatMap(({ group, members }) =>
          members.map((member): readonly [string, string] => [member.name, group.name]),
        ),
      },
      teach: { text: sorting.teach },
    };
  };
