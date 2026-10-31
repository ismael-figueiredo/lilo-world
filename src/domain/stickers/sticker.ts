import { MAX_LEVEL, stations, type Station } from '@domain/curriculum/skill';

export type StickerId = string;

export interface Sticker {
  readonly id: StickerId;
  readonly name: string;
  readonly picture: string;
}

const skillStickers: Readonly<Record<Station, readonly [string, string][]>> = {
  letters: [
    ['Primeiras letras', '🔤'],
    ['Conhece as letras', '📖'],
    ['Letras das palavras', '📚'],
  ],
  numbers: [
    ['Primeiros números', '🔢'],
    ['Conta até 5', '🖐️'],
    ['Conta até 10', '🔟'],
  ],
  coins: [
    ['Primeiras compras', '🪙'],
    ['Paga certinho', '👛'],
    ['Craque das moedas', '💰'],
  ],
  world: [
    ['Primeiras descobertas', '🌱'],
    ['Conhece o mundo', '🌎'],
    ['Pequeno explorador', '🧭'],
  ],
};

/**
 * The sticker of a level: the first is for a first right answer, the others for
 * reaching that level, which means the level before it was done well. Names say
 * what the child already did, never what comes next.
 */
export const stickerId = (skill: Station, level: number): StickerId => `${skill}-${level}`;

/** Every sticker of the album, in the order they are shown. Level 1 is where everyone starts. */
export const albumStickers: readonly Sticker[] = stations.flatMap((skill) =>
  skillStickers[skill].slice(0, MAX_LEVEL).map(([name, picture], index) => ({
    id: stickerId(skill, index + 1),
    name,
    picture,
  })),
);

/** The animal notebook: one sticker for each animal met at the zoo. */
export const animalStickerId = (animal: string): StickerId => `animal-${animal}`;

export const beachStickerId = (memory: string): StickerId => `beach-${memory}`;

/** Only what the album shows of each animal: the rest loads with the zoo. */
const animalPages: readonly (readonly [string, string, string])[] = [
  ['lion', 'Leão', '🦁'],
  ['elephant', 'Elefante', '🐘'],
  ['giraffe', 'Girafa', '🦒'],
  ['monkey', 'Macaco', '🐒'],
  ['zebra', 'Zebra', '🦓'],
  ['penguin', 'Pinguim', '🐧'],
  ['bear', 'Urso', '🐻'],
  ['hippo', 'Hipopótamo', '🦛'],
  ['flamingo', 'Flamingo', '🦩'],
  ['turtle', 'Tartaruga', '🐢'],
];

/** Every sticker the album shows, from what is learned to who was met. */
export const allStickers: readonly Sticker[] = [
  ...albumStickers,
  ...animalPages.map(([id, name, picture]) => ({ id: animalStickerId(id), name, picture })),
  { id: beachStickerId('castle'), name: 'Castelo de areia', picture: '🏰' },
];

/** Letters of the collectable alphabet. */
export const ALBUM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
