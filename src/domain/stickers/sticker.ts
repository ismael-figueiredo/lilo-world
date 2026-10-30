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
    ['Leitor de letras', '📖'],
    ['Leitor de palavras', '📚'],
  ],
  numbers: [
    ['Conta até 5', '🖐️'],
    ['Conta até 10', '🔟'],
    ['Faz somas', '➕'],
  ],
  coins: [
    ['Primeiras compras', '🪙'],
    ['Paga certinho', '👛'],
    ['Craque das moedas', '💰'],
  ],
};

/** The sticker earned by reaching a level of a skill (levels start at 1; level 1 is free). */
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
