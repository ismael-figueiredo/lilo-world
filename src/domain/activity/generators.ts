import type { ActivityBuilder, ActivityOption, Picture } from '@domain/activity/activity';
import { firstLetter, type Word } from '@domain/language/word';
import { pick, randomInt, shuffled, type Random } from '@domain/shared/random';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const COUNTABLE: readonly Picture[] = ['🍎', '⭐', '🐟', '🌸', '🚗', '🎈'].map((pictogram) => ({
  pictogram,
}));
const COIN: Picture = { pictogram: '🪙' };

/** Things a child buys, for the coin activities. */
const SHOP_ITEMS: readonly (Picture & { readonly name: string })[] = [
  { name: 'Maçã', pictogram: '🍎' },
  { name: 'Banana', pictogram: '🍌' },
  { name: 'Pão', pictogram: '🍞' },
  { name: 'Suco', pictogram: '🧃' },
  { name: 'Balão', pictogram: '🎈' },
  { name: 'Sorvete', pictogram: '🍦' },
  { name: 'Bola', pictogram: '⚽' },
  { name: 'Lápis', pictogram: '✏️' },
];

/** Groups of five, which are easy to see and count (as on a hand). */
const groupsOf = (count: number): readonly number[] => (count > 5 ? [5, count - 5] : [count]);

const numberOption = (value: number): ActivityOption => ({
  id: String(value),
  label: String(value),
  text: String(value),
});

const letterOption = (letter: string): ActivityOption => ({
  id: letter,
  label: letter,
  text: letter,
});

const wordPicture = ({ pictogram, image }: Word): Picture =>
  image === undefined ? { pictogram } : { pictogram, image };

/** The right answer plus distinct wrong ones, in random order. */
function withDistractors(
  random: Random,
  answer: number,
  count: number,
  min: number,
  max: number,
): number[] {
  const values = new Set([answer]);
  // Near numbers first: telling 3 from 4 is the useful skill.
  const near = shuffled(random, [answer - 1, answer + 1, answer - 2, answer + 2]);
  for (const value of near) {
    if (values.size >= count) break;
    if (value >= min && value <= max) values.add(value);
  }
  while (values.size < count) values.add(randomInt(random, min, max));
  return shuffled(random, [...values]);
}

const lettersWith = (random: Random, letter: string, count: number): ActivityOption[] => {
  const others = shuffled(
    random,
    ALPHABET.filter((l) => l !== letter),
  ).slice(0, count - 1);
  return shuffled(random, [letter, ...others]).map(letterOption);
};

/** Any letter of the alphabet, by its name: this is how the whole album can be filled. */
export const findLetter =
  ({ options }: { options: number }): ActivityBuilder =>
  ({ random }) => {
    const letter = pick(random, ALPHABET);
    return {
      prompt: { text: `Onde está a letra ${letter}?` },
      stimulus: { kind: 'none' },
      interaction: {
        kind: 'tap',
        options: lettersWith(random, letter, options),
        answerId: letter,
      },
      teach: { text: `Esta é a letra ${letter}.` },
      letter,
    };
  };

export const wordFirstLetter =
  ({ options }: { options: number }): ActivityBuilder =>
  ({ random, words }) => {
    const chosen = pick(random, words);
    const letter = firstLetter(chosen.text);
    const name = chosen.text.toLowerCase();
    return {
      prompt: { text: `Com qual letra começa ${name}?` },
      // Only the picture: the written word would show the answer.
      stimulus: { kind: 'picture', picture: wordPicture(chosen) },
      interaction: {
        kind: 'tap',
        options: lettersWith(random, letter, options),
        answerId: letter,
      },
      teach: { text: `${name} começa com a letra ${letter}.` },
      letter,
    };
  };

/** Word ↔ picture: read the word, find its picture. */
export const readWord =
  ({ options }: { options: number }): ActivityBuilder =>
  ({ random, words }) => {
    const chosen = pick(random, words);
    const letter = firstLetter(chosen.text);
    const others = shuffled(
      random,
      words.filter((w) => firstLetter(w.text) !== letter && w.pictogram !== chosen.pictogram),
    ).slice(0, options - 1);
    return {
      // The child reads: saying the word aloud would turn this into a listening exercise.
      prompt: { text: 'Leia a palavra. Qual é a figura?' },
      stimulus: { kind: 'word', text: chosen.text },
      interaction: {
        kind: 'tap',
        options: shuffled(random, [chosen, ...others]).map((w) => ({
          id: w.text,
          label: w.text.toLowerCase(),
          picture: wordPicture(w),
        })),
        answerId: chosen.text,
      },
      teach: { text: `Esta é a figura de ${chosen.text.toLowerCase()}.` },
      letter,
    };
  };

export const countObjects =
  ({ max }: { max: number }): ActivityBuilder =>
  ({ random }) => {
    const answer = randomInt(random, 1, max);
    return {
      prompt: { text: 'Quantos tem? Conte comigo.' },
      stimulus: { kind: 'objects', picture: pick(random, COUNTABLE), groups: groupsOf(answer) },
      interaction: {
        kind: 'tap',
        options: withDistractors(random, answer, 3, 1, max).map(numberOption),
        answerId: String(answer),
      },
      teach: { text: `Aqui tem ${answer}.` },
    };
  };

/** Objects first: moving each one while counting comes before reading a number. */
export const carryObjects =
  ({ max }: { max: number }): ActivityBuilder =>
  ({ random }) => {
    const goal = randomInt(random, 1, max);
    return {
      prompt: { text: `Leve ${goal} para a cesta.` },
      stimulus: { kind: 'none' },
      interaction: {
        kind: 'drag',
        piece: pick(random, COUNTABLE),
        supply: Math.min(max + 2, goal + 3),
        goal,
        target: '🧺',
      },
      teach: { text: `Olhe: ${goal} na cesta.` },
    };
  };

/** Visual sum: two groups of the same picture. */
export const addObjects =
  ({ max }: { max: number }): ActivityBuilder =>
  ({ random }) => {
    const half = Math.floor(max / 2);
    const a = randomInt(random, 1, half);
    const b = randomInt(random, 1, half);
    const answer = a + b;
    return {
      prompt: { text: `Quanto é ${a} mais ${b}?` },
      stimulus: { kind: 'sum', picture: pick(random, COUNTABLE), a, b },
      interaction: {
        kind: 'tap',
        options: withDistractors(random, answer, 3, 2, max).map(numberOption),
        answerId: String(answer),
      },
      teach: { text: `${a} mais ${b} é igual a ${answer}.` },
    };
  };

export const payCoins =
  ({ max }: { max: number }): ActivityBuilder =>
  ({ random }) => {
    const price = randomInt(random, 1, max);
    const item = pick(random, SHOP_ITEMS);
    const coins = (count: number) => `${count} ${count === 1 ? 'moeda' : 'moedas'}`;
    return {
      prompt: { text: `${item.name} custa ${coins(price)}. Leve as moedas ao caixa.` },
      stimulus: { kind: 'price', picture: { pictogram: item.pictogram }, price },
      interaction: {
        kind: 'drag',
        piece: COIN,
        supply: Math.min(max + 2, price + 3),
        goal: price,
        target: '🧾',
      },
      teach: { text: `São ${coins(price)}.` },
    };
  };
