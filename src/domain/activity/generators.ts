import {
  scrambled,
  type ActivityBuilder,
  type ActivityContext,
  type ActivityOption,
  type Picture,
} from '@domain/activity/activity';
import { firstLetter, type Word } from '@domain/language/word';
import { pick, randomInt, shuffled, type Random } from '@domain/shared/random';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const COUNTABLE: readonly Picture[] = [
  { pictogram: '🍎', thing: 'apple' },
  { pictogram: '⭐', thing: 'star' },
  { pictogram: '🐟', thing: 'fish' },
  { pictogram: '🌸', thing: 'flower' },
  { pictogram: '🚗', thing: 'car' },
  { pictogram: '🎈', thing: 'balloon' },
];
const COIN: Picture = { pictogram: '🪙', thing: 'coin' };

/** Highest quantity of a round's first question, and how far below the top others may go. */
const RAMP_START = 3;
const RAMP_SPREAD = 2;

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

/** Quantities grow along a round, in small steps: never from 1 straight to the top. */
function steppedAmount({ random, progress = 1 }: ActivityContext, max: number): number {
  const start = Math.min(RAMP_START, max);
  const top = Math.round(start + (max - start) * progress);
  return randomInt(random, Math.max(1, top - RAMP_SPREAD), top);
}

export const numberOption = (value: number): ActivityOption => ({
  id: String(value),
  label: String(value),
  text: String(value),
});

export const letterOption = (letter: string): ActivityOption => ({
  id: letter,
  label: letter,
  text: letter,
});

export const wordPicture = ({ pictogram, image }: Word): Picture =>
  image === undefined ? { pictogram } : { pictogram, image };

/** The right answer plus distinct wrong ones, in random order. */
export function withDistractors(
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

export const lettersWith = (random: Random, letter: string, count: number): ActivityOption[] => {
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
      // The name is heard: writing the letter would turn this into matching shapes.
      prompt: {
        text: `Onde está a letra ${letter}?`,
        written: 'Onde está a letra?',
        needsVoice: true,
      },
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
      // Only the picture, here and in the question: the written word would show the answer.
      prompt: { text: `Com qual letra começa ${name}?`, written: 'Com qual letra começa?' },
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
  (context) => {
    const { random } = context;
    const answer = steppedAmount(context, max);
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
  (context) => {
    const { random } = context;
    const goal = steppedAmount(context, max);
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
  (context) => {
    const { random } = context;
    const price = steppedAmount(context, max);
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

/** Fewer or more: two plates, never the same amount. */
export const compareGroups =
  ({ max }: { max: number }): ActivityBuilder =>
  ({ random }) => {
    const a = randomInt(random, 1, max);
    const others = Array.from({ length: max }, (_, index) => index + 1).filter((n) => n !== a);
    const b = pick(random, others);
    const options: readonly ActivityOption[] = [
      { id: 'blue', label: 'Prato azul', picture: { pictogram: '🔵' } },
      { id: 'red', label: 'Prato vermelho', picture: { pictogram: '🔴' } },
    ];
    const more = a > b ? 'azul' : 'vermelho';
    return {
      prompt: { text: 'Qual prato tem mais?' },
      stimulus: { kind: 'compare', picture: pick(random, COUNTABLE), a, b },
      interaction: { kind: 'tap', options, answerId: a > b ? 'blue' : 'red' },
      teach: { text: `O prato ${more} tem mais.` },
    };
  };

/** Visual subtraction: some of the things really go away. */
export const takeAway =
  ({ max }: { max: number }): ActivityBuilder =>
  ({ random }) => {
    const a = randomInt(random, 2, max);
    const b = randomInt(random, 1, a - 1);
    const answer = a - b;
    return {
      // The numbers are heard and seen on the desk: written, one could be the answer.
      prompt: { text: `Tinha ${a}. Saíram ${b}. Quantos ficaram?`, written: 'Quantos ficaram?' },
      stimulus: { kind: 'minus', picture: pick(random, COUNTABLE), a, b },
      interaction: {
        kind: 'tap',
        options: withDistractors(random, answer, 3, 0, max).map(numberOption),
        answerId: String(answer),
      },
      teach: { text: `${a} menos ${b} é igual a ${answer}.` },
    };
  };

/** The number that is missing in a row. */
export const missingNumber =
  ({ max, length }: { max: number; length: number }): ActivityBuilder =>
  ({ random }) => {
    const start = randomInt(random, 1, max - length + 1);
    const row = Array.from({ length }, (_, index) => start + index);
    // Never the first: the numbers before it are what the child uses to find it.
    const hidden = randomInt(random, 1, length - 1);
    const answer = start + hidden;
    return {
      prompt: { text: 'Qual número está faltando?' },
      stimulus: {
        kind: 'word',
        text: row.map((value, index) => (index === hidden ? '_' : value)).join(' '),
      },
      interaction: {
        kind: 'tap',
        options: withDistractors(random, answer, 3, 1, max).map(numberOption),
        answerId: String(answer),
      },
      teach: { text: `Depois do ${answer - 1} vem o ${answer}.` },
    };
  };

/** Numbers from the smallest to the biggest. */
export const orderNumbers =
  ({ max, length }: { max: number; length: number }): ActivityBuilder =>
  ({ random }) => {
    const start = randomInt(random, 1, max - length + 1);
    const row = Array.from({ length }, (_, index) => start + index);
    return {
      prompt: { text: 'Coloque em ordem, do menor para o maior.' },
      stimulus: { kind: 'none' },
      interaction: {
        kind: 'order',
        pieces: scrambled(random, row.map(numberOption), row.map(String)),
        answer: row.map(String),
      },
      teach: { text: `A ordem é ${row.join(', ')}.` },
    };
  };

const SHAPES: readonly (Picture & { readonly name: string; readonly article: string })[] = [
  { name: 'círculo', article: 'o', pictogram: '🔴' },
  { name: 'quadrado', article: 'o', pictogram: '🟦' },
  { name: 'triângulo', article: 'o', pictogram: '🔺' },
  { name: 'estrela', article: 'a', pictogram: '⭐' },
];

export const findShape =
  ({ options }: { options: number }): ActivityBuilder =>
  ({ random }) => {
    const chosen = pick(random, SHAPES);
    const others = shuffled(
      random,
      SHAPES.filter((shape) => shape !== chosen),
    ).slice(0, options - 1);
    return {
      prompt: { text: `Onde está ${chosen.article} ${chosen.name}?` },
      stimulus: { kind: 'none' },
      interaction: {
        kind: 'tap',
        options: shuffled(random, [chosen, ...others]).map((shape) => ({
          id: shape.name,
          label: shape.name,
          picture: { pictogram: shape.pictogram },
        })),
        answerId: chosen.name,
      },
      teach: { text: `${chosen.article === 'a' ? 'Esta é a' : 'Este é o'} ${chosen.name}.` },
    };
  };

const hours = (hour: number): string => `${hour} ${hour === 1 ? 'hora' : 'horas'}`;

/** Whole hours on a real clock. */
export const readClock: ActivityBuilder = ({ random }) => {
  const hour = randomInt(random, 1, 12);
  return {
    prompt: { text: 'Que horas são?' },
    stimulus: { kind: 'clock', hour },
    interaction: {
      kind: 'tap',
      options: withDistractors(random, hour, 3, 1, 12).map((value) => ({
        id: String(value),
        label: hours(value),
        text: hours(value),
      })),
      answerId: String(hour),
    },
    teach: { text: `São ${hours(hour)}. O ponteiro pequeno mostra a hora.` },
  };
};

const CASH_VALUES = [1, 2, 5, 10] as const;

/** Adding toy money: the same notes and coins the market will ask for. */
export const countCash =
  ({ max, pieces }: { max: number; pieces: number }): ActivityBuilder =>
  ({ random }) => {
    const values: number[] = [];
    while (values.length < pieces) {
      const room = max - values.reduce((sum, value) => sum + value, 0);
      const value = pick(
        random,
        CASH_VALUES.filter((candidate) => candidate <= room - (pieces - values.length - 1)),
      );
      values.push(value);
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    const reais = (count: number) => `${count} ${count === 1 ? 'real' : 'reais'}`;
    return {
      prompt: { text: 'Quanto dinheiro tem aqui?' },
      stimulus: { kind: 'cash', values },
      interaction: {
        kind: 'tap',
        options: withDistractors(random, total, 3, 1, max).map((value) => ({
          id: String(value),
          label: reais(value),
          text: `R$ ${value}`,
        })),
        answerId: String(total),
      },
      teach: { text: `Aqui tem ${reais(total)}.` },
    };
  };
