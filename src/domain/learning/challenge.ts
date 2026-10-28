import { pick, randomInt, shuffled, type Random } from '@domain/shared/random';

/** What the learning stations train. */
export type Skill = 'letters' | 'numbers' | 'coins';

export const skills: readonly Skill[] = ['letters', 'numbers', 'coins'];

/** Levels per skill. Each new level gives a sticker and a star. */
export const MAX_LEVEL = 3;

/** A word the child knows from pictures, in capital letters (as taught in early literacy). */
export interface Word {
  readonly text: string;
  readonly pictogram: string;
}

export interface ChallengeOption {
  readonly id: string;
  /** Read aloud and shown under the picture. */
  readonly label: string;
  /** Big content of the card: a letter, a number, a picture or coins. */
  readonly face: string;
}

/** One question with a few big cards to choose from; exactly one is right. */
export interface Challenge {
  readonly skill: Skill;
  readonly level: number;
  /** Short sentence read by the game. */
  readonly question: string;
  /** What is shown big above the cards (pictures to count, a word, a price). */
  readonly show: string;
  readonly options: readonly ChallengeOption[];
  readonly answerId: string;
  /** A letter the child collects for the alphabet album when this is solved. */
  readonly letter?: string;
}

const ALPHABET = 'ABCDEFGHIJLMNOPRSTUVZ'.split('');
const COUNTABLE = ['🍎', '⭐', '🐟', '🌸', '🚗', '🎈'];
/** Things a child buys, for the coin challenges. */
const SHOP_ITEMS: readonly Word[] = [
  { text: 'MAÇÃ', pictogram: '🍎' },
  { text: 'BANANA', pictogram: '🍌' },
  { text: 'PÃO', pictogram: '🍞' },
  { text: 'SUCO', pictogram: '🧃' },
  { text: 'BALÃO', pictogram: '🎈' },
  { text: 'SORVETE', pictogram: '🍦' },
  { text: 'BOLA', pictogram: '⚽' },
  { text: 'LÁPIS', pictogram: '✏️' },
];

/** First letter without accent marks: ÁRVORE starts with A. */
export const firstLetter = (text: string): string => text.normalize('NFD').charAt(0).toUpperCase();

const numberOption = (value: number, face = String(value)): ChallengeOption => ({
  id: String(value),
  label: String(value),
  face,
});

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

function letterChallenge(random: Random, level: number, words: readonly Word[]): Challenge {
  const word = pick(random, words);
  const letter = firstLetter(word.text);

  if (level >= 3) {
    // Word ↔ picture: read the word, find its picture.
    const others = shuffled(
      random,
      words.filter((w) => firstLetter(w.text) !== letter && w.pictogram !== word.pictogram),
    ).slice(0, 2);
    const options = shuffled(random, [word, ...others]).map((w) => ({
      id: w.text,
      label: w.text.toLowerCase(),
      face: w.pictogram,
    }));
    return {
      skill: 'letters',
      level,
      question: `Qual figura é ${word.text.toLowerCase()}?`,
      show: word.text,
      options,
      answerId: word.text,
      letter,
    };
  }

  const count = level === 1 ? 3 : 4;
  const others = shuffled(
    random,
    ALPHABET.filter((l) => l !== letter),
  ).slice(0, count - 1);
  const options = shuffled(random, [letter, ...others]).map((l) => ({ id: l, label: l, face: l }));
  return {
    skill: 'letters',
    level,
    question: `Com qual letra começa ${word.text.toLowerCase()}?`,
    show: `${word.pictogram} ${word.text}`,
    options,
    answerId: letter,
    letter,
  };
}

function numberChallenge(random: Random, level: number): Challenge {
  if (level >= 3) {
    // Visual sum up to 10: two groups of the same picture.
    const a = randomInt(random, 1, 5);
    const b = randomInt(random, 1, 5);
    const thing = pick(random, COUNTABLE);
    const answer = a + b;
    return {
      skill: 'numbers',
      level,
      question: `Quanto é ${a} mais ${b}?`,
      show: `${thing.repeat(a)} ➕ ${thing.repeat(b)}`,
      options: withDistractors(random, answer, 3, 2, 10).map((v) => numberOption(v)),
      answerId: String(answer),
    };
  }
  const max = level === 1 ? 5 : 10;
  const answer = randomInt(random, 1, max);
  const thing = pick(random, COUNTABLE);
  return {
    skill: 'numbers',
    level,
    question: 'Quantos tem? Conte comigo.',
    show: thing.repeat(answer),
    options: withDistractors(random, answer, 3, 1, max).map((v) => numberOption(v)),
    answerId: String(answer),
  };
}

function coinChallenge(random: Random, level: number): Challenge {
  const max = level === 1 ? 3 : level === 2 ? 6 : 10;
  const price = randomInt(random, 1, max);
  const item = pick(random, SHOP_ITEMS);
  return {
    skill: 'coins',
    level,
    question: `${item.text.charAt(0)}${item.text.slice(1).toLowerCase()} custa ${price} ${price === 1 ? 'moeda' : 'moedas'}. Quantas moedas você dá?`,
    show: `${item.pictogram} = ${price} 🪙`,
    options: withDistractors(random, price, 3, 1, max).map((v) => numberOption(v, '🪙'.repeat(v))),
    answerId: String(price),
  };
}

/** A new challenge for a skill at a level (1 to MAX_LEVEL). Pure: same random, same challenge. */
export function createChallenge(
  skill: Skill,
  level: number,
  random: Random,
  words: readonly Word[],
): Challenge {
  const safeLevel = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);
  switch (skill) {
    case 'letters':
      return letterChallenge(random, safeLevel, words);
    case 'numbers':
      return numberChallenge(random, safeLevel);
    case 'coins':
      return coinChallenge(random, safeLevel);
  }
}
