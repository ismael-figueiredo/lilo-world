import { scrambled, type ActivityBuilder, type Picture } from '@domain/activity/activity';
import { wordPicture } from '@domain/activity/generators';
import type { Word } from '@domain/language/word';
import { pick, shuffled, type Random } from '@domain/shared/random';

const VOWELS = ['A', 'E', 'I', 'O', 'U'];
const CONSONANTS = ['B', 'C', 'D', 'F', 'G', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V'];

const textOption = (text: string) => ({ id: text, label: text.toLowerCase(), text });

const longWords = (words: readonly Word[]): readonly Word[] =>
  words.filter((word) => word.syllables.length > 1);

export const findVowel =
  ({ options }: { options: number }): ActivityBuilder =>
  ({ random }) => {
    const vowel = pick(random, VOWELS);
    const others = shuffled(random, CONSONANTS).slice(0, options - 1);
    return {
      prompt: { text: 'Onde está a vogal?' },
      stimulus: { kind: 'none' },
      interaction: {
        kind: 'tap',
        options: shuffled(random, [vowel, ...others]).map(textOption),
        answerId: vowel,
      },
      teach: { text: `${vowel} é uma vogal.` },
      letter: vowel,
    };
  };

/** The word is only seen in the picture: hearing it is the help, not the answer. */
export const orderSyllables: ActivityBuilder = ({ random, words }) => {
  const chosen = pick(random, longWords(words));
  const ids = chosen.syllables.map((syllable, index) => `${index}-${syllable}`);
  const pieces = chosen.syllables.map((syllable, index) => ({
    id: `${index}-${syllable}`,
    label: `Sílaba ${syllable.toLowerCase()}`,
    text: syllable,
  }));
  const name = chosen.text.toLowerCase();
  return {
    prompt: { text: `Monte a palavra ${name}.`, written: 'Monte a palavra.' },
    stimulus: { kind: 'picture', picture: wordPicture(chosen) },
    interaction: { kind: 'order', pieces: scrambled(random, pieces, ids), answer: ids },
    teach: { text: `${chosen.syllables.join('-').toLowerCase()}, ${name}.` },
  };
};

export const firstSyllable =
  ({ options }: { options: number }): ActivityBuilder =>
  ({ random, words }) => {
    const candidates = longWords(words);
    const chosen = pick(random, candidates);
    const [first = '', ...rest] = chosen.syllables;
    const others = [...new Set(candidates.map((word) => word.syllables[0] ?? ''))].filter(
      (syllable) => syllable !== first,
    );
    const name = chosen.text.toLowerCase();
    return {
      prompt: { text: `Complete: ${name}.`, written: 'Qual sílaba completa a palavra?' },
      stimulus: { kind: 'word', text: `_ ${rest.join('')}`, picture: wordPicture(chosen) },
      interaction: {
        kind: 'tap',
        options: shuffled(random, [first, ...shuffled(random, others).slice(0, options - 1)]).map(
          textOption,
        ),
        answerId: first,
      },
      teach: { text: `${name} começa com ${first.toLowerCase()}.` },
    };
  };

export interface RhymeWord extends Picture {
  readonly name: string;
}

/** Words of one set rhyme with each other, and with no word of another set. */
export const findRhyme =
  ({
    sets,
    options,
  }: {
    sets: readonly (readonly RhymeWord[])[];
    options: number;
  }): ActivityBuilder =>
  ({ random }) => {
    const set = pick(random, sets);
    const [chosen, answer] = shuffled(random, set);
    if (chosen === undefined || answer === undefined) throw new Error('A rhyme needs two words');
    const others = pickOnePerSet(
      random,
      sets.filter((other) => other !== set),
    ).slice(0, options - 1);
    return {
      prompt: { text: `O que rima com ${chosen.name}?`, written: 'O que rima com esta figura?' },
      stimulus: { kind: 'picture', picture: { pictogram: chosen.pictogram } },
      interaction: {
        kind: 'tap',
        options: shuffled(random, [answer, ...others]).map((word) => ({
          id: word.name,
          label: word.name,
          picture: { pictogram: word.pictogram },
        })),
        answerId: answer.name,
      },
      teach: { text: `${chosen.name} rima com ${answer.name}.` },
    };
  };

const pickOnePerSet = (random: Random, sets: readonly (readonly RhymeWord[])[]): RhymeWord[] =>
  shuffled(random, sets).map((set) => pick(random, set));

export interface CountableWord extends Picture {
  /** With its article: "a bola". */
  readonly singular: string;
  readonly plural: string;
}

/** One or many: the amount on the desk decides the word. */
export const pluralWord =
  ({ words }: { words: readonly CountableWord[] }): ActivityBuilder =>
  ({ random }) => {
    const chosen = pick(random, words);
    const many = random() < 0.5;
    const amount = many ? 3 : 1;
    const [article = '', name = ''] = chosen.singular.split(' ');
    const answer = many ? chosen.plural : name;
    return {
      prompt: { text: 'Qual palavra combina?' },
      stimulus: {
        kind: 'objects',
        picture: chosen,
        groups: [amount],
      },
      interaction: {
        kind: 'tap',
        options: shuffled(random, [name, chosen.plural]).map((text) => ({
          id: text,
          label: text,
          text: text.toUpperCase(),
        })),
        answerId: answer,
      },
      teach: {
        text: many ? `Três ${chosen.plural}.` : `Só ${article === 'a' ? 'uma' : 'um'} ${name}.`,
      },
    };
  };

/** O or A before the word. */
export const chooseArticle =
  ({ words }: { words: readonly CountableWord[] }): ActivityBuilder =>
  ({ random }) => {
    const chosen = pick(random, words);
    const [article = '', name = ''] = chosen.singular.split(' ');
    return {
      prompt: { text: 'Qual palavra completa?' },
      stimulus: {
        kind: 'word',
        text: `_ ${name.toUpperCase()}`,
        picture: { pictogram: chosen.pictogram },
      },
      interaction: {
        kind: 'tap',
        options: ['A', 'O'].map(textOption),
        answerId: article.toUpperCase(),
      },
      teach: { text: `${chosen.singular}.` },
    };
  };

/** A short sentence in pieces. Heard only as the teaching, or it would be dictation. */
export const orderSentence =
  ({ sentences }: { sentences: readonly string[] }): ActivityBuilder =>
  ({ random }) => {
    const sentence = pick(random, sentences);
    const words = sentence.split(' ');
    const ids = words.map((word, index) => `${index}-${word}`);
    const pieces = words.map((word, index) => ({
      id: `${index}-${word}`,
      label: word.toLowerCase(),
      text: word,
    }));
    return {
      prompt: { text: 'Coloque as palavras em ordem.' },
      stimulus: { kind: 'none' },
      interaction: { kind: 'order', pieces: scrambled(random, pieces, ids), answer: ids },
      teach: { text: `${sentence.toLowerCase()}.` },
    };
  };
