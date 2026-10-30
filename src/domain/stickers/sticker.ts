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

/** Letters of the collectable alphabet. */
export const ALBUM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
