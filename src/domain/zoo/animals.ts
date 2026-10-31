import { pick, shuffled, type Random } from '@domain/shared/random';

export type AnimalId =
  | 'lion'
  | 'elephant'
  | 'giraffe'
  | 'monkey'
  | 'zebra'
  | 'penguin'
  | 'bear'
  | 'hippo'
  | 'flamingo'
  | 'turtle';

export interface Animal {
  readonly id: AnimalId;
  readonly name: string;
  /** With its article, for the voice. */
  readonly called: string;
  readonly icon: string;
  readonly food: string;
  readonly foodIcon: string;
  readonly home: string;
  readonly homeIcon: string;
  /** What it does with its voice. */
  readonly sound: string;
  readonly legs: number;
  /** One short fact, said when the child comes close. */
  readonly fact: string;
}

const animal = (a: Animal): Animal => a;

const sentence = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const animals: readonly Animal[] = [
  animal({
    id: 'lion',
    name: 'Leão',
    called: 'o leão',
    icon: '🦁',
    food: 'carne',
    foodIcon: '🍖',
    home: 'savana',
    homeIcon: '🌾',
    sound: 'ruge',
    legs: 4,
    fact: 'O leão descansa a maior parte do dia.',
  }),
  animal({
    id: 'elephant',
    name: 'Elefante',
    called: 'o elefante',
    icon: '🐘',
    food: 'folhas',
    foodIcon: '🌿',
    home: 'savana',
    homeIcon: '🌾',
    sound: 'barre',
    legs: 4,
    fact: 'O elefante pega comida com a tromba.',
  }),
  animal({
    id: 'giraffe',
    name: 'Girafa',
    called: 'a girafa',
    icon: '🦒',
    food: 'folhas',
    foodIcon: '🌿',
    home: 'savana',
    homeIcon: '🌾',
    sound: 'faz pouco barulho',
    legs: 4,
    fact: 'A girafa alcança as folhas mais altas.',
  }),
  animal({
    id: 'monkey',
    name: 'Macaco',
    called: 'o macaco',
    icon: '🐒',
    food: 'banana',
    foodIcon: '🍌',
    home: 'floresta',
    homeIcon: '🌳',
    sound: 'guincha',
    legs: 2,
    fact: 'O macaco usa as mãos para subir nas árvores.',
  }),
  animal({
    id: 'zebra',
    name: 'Zebra',
    called: 'a zebra',
    icon: '🦓',
    food: 'capim',
    foodIcon: '🌱',
    home: 'savana',
    homeIcon: '🌾',
    sound: 'relincha',
    legs: 4,
    fact: 'Cada zebra tem listras diferentes.',
  }),
  animal({
    id: 'penguin',
    name: 'Pinguim',
    called: 'o pinguim',
    icon: '🐧',
    food: 'peixe',
    foodIcon: '🐟',
    home: 'gelo',
    homeIcon: '🧊',
    sound: 'grasna',
    legs: 2,
    fact: 'O pinguim não voa, mas nada muito bem.',
  }),
  animal({
    id: 'bear',
    name: 'Urso',
    called: 'o urso',
    icon: '🐻',
    food: 'mel',
    foodIcon: '🍯',
    home: 'floresta',
    homeIcon: '🌳',
    sound: 'urra',
    legs: 4,
    fact: 'O urso gosta de frutas e de mel.',
  }),
  animal({
    id: 'hippo',
    name: 'Hipopótamo',
    called: 'o hipopótamo',
    icon: '🦛',
    food: 'capim',
    foodIcon: '🌱',
    home: 'rio',
    homeIcon: '🏞️',
    sound: 'bufa',
    legs: 4,
    fact: 'O hipopótamo passa o dia dentro da água.',
  }),
  animal({
    id: 'flamingo',
    name: 'Flamingo',
    called: 'o flamingo',
    icon: '🦩',
    food: 'camarão',
    foodIcon: '🍤',
    home: 'lago',
    homeIcon: '🏞️',
    sound: 'grasna',
    legs: 2,
    fact: 'O flamingo dorme em uma perna só.',
  }),
  animal({
    id: 'turtle',
    name: 'Tartaruga',
    called: 'a tartaruga',
    icon: '🐢',
    food: 'alface',
    foodIcon: '🥬',
    home: 'rio',
    homeIcon: '🏞️',
    sound: 'fica em silêncio',
    legs: 4,
    fact: 'A tartaruga leva a casca nas costas.',
  }),
];

export const animalOf = (id: AnimalId): Animal => {
  const found = animals.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No animal ${id}`);
  return found;
};

export const isAnimal = (id: string): id is AnimalId =>
  animals.some((candidate) => candidate.id === id);

export const TICKET_PRICE = 500;
export const OUTING_WALLET: readonly number[] = [500, 200, 100];

export interface ZooOption {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
}

export interface ZooChallenge {
  readonly question: string;
  readonly options: readonly ZooOption[];
  readonly answerId: string;
  readonly teach: string;
}

const distinct = <T>(random: Random, list: readonly T[], key: (item: T) => string, not: string) => {
  const seen = new Set([not]);
  return shuffled(random, list).filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const withOthers = (
  random: Random,
  right: ZooOption,
  others: readonly ZooOption[],
): readonly ZooOption[] => shuffled(random, [right, ...others.slice(0, 2)]);

export function foodOptions(chosen: Animal, random: Random): readonly ZooOption[] {
  const right = { id: chosen.food, icon: chosen.foodIcon, label: chosen.food };
  const others = distinct(random, animals, (a) => a.food, chosen.food).map((a) => ({
    id: a.food,
    icon: a.foodIcon,
    label: a.food,
  }));
  return withOthers(random, right, others);
}

/** One question about the animal in front of the child, with the answer in sight. */
export function zooChallenge(chosen: Animal, random: Random): ZooChallenge {
  const kinds: readonly (() => ZooChallenge)[] = [
    () => ({
      question: `O que ${chosen.called} come?`,
      options: foodOptions(chosen, random),
      answerId: chosen.food,
      teach: sentence(`${chosen.called} come ${chosen.food}.`),
    }),
    () => ({
      question: `Onde ${chosen.called} vive?`,
      options: withOthers(
        random,
        { id: chosen.home, icon: chosen.homeIcon, label: chosen.home },
        distinct(random, animals, (a) => a.home, chosen.home).map((a) => ({
          id: a.home,
          icon: a.homeIcon,
          label: a.home,
        })),
      ),
      answerId: chosen.home,
      teach: sentence(`${chosen.called} vive em: ${chosen.home}.`),
    }),
    () => ({
      question: `Quantas patas ${chosen.called} tem?`,
      options: shuffled(
        random,
        [chosen.legs, chosen.legs === 2 ? 4 : 2, 6].map((legs) => ({
          id: String(legs),
          icon: '🐾',
          label: String(legs),
        })),
      ),
      answerId: String(chosen.legs),
      teach: sentence(`${chosen.called} tem ${chosen.legs} patas.`),
    }),
  ];
  return pick(random, kinds)();
}
