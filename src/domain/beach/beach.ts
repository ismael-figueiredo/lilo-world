import type { Weather } from '@domain/day/weather';
import { pick, randomInt, shuffled, type Random } from '@domain/shared/random';

/** A day for the beach: sun or light clouds. Any other day the bus takes nobody there. */
export const isBeachDay = (weather: Weather): boolean =>
  weather === 'sunny' || weather === 'cloudy';

export type PackItem = 'swimsuit' | 'sunscreen' | 'hat' | 'towel' | 'coat' | 'boots';

export interface PackLook {
  readonly id: PackItem;
  readonly icon: string;
  readonly label: string;
}

export const packItems: readonly PackLook[] = [
  { id: 'swimsuit', icon: '🩱', label: 'Roupa de banho' },
  { id: 'sunscreen', icon: '🧴', label: 'Protetor' },
  { id: 'hat', icon: '👒', label: 'Chapéu' },
  { id: 'towel', icon: '🏖️', label: 'Toalha' },
  { id: 'coat', icon: '🧥', label: 'Casaco' },
  { id: 'boots', icon: '🥾', label: 'Botas' },
];

/** What goes in the bag. Coat and boots are there so that choosing means something. */
export const packList: readonly PackItem[] = ['swimsuit', 'sunscreen', 'hat', 'towel'];

export const isPacked = (packed: readonly PackItem[]): boolean =>
  packList.every((item) => packed.includes(item));

/** The sea is shown with its flag: only with the green one the child goes in the shallow water. */
export type SeaFlag = 'green' | 'yellow';

export const seaFlag = (weather: Weather): SeaFlag => (weather === 'sunny' ? 'green' : 'yellow');

export const mayEnterWater = (flag: SeaFlag): boolean => flag === 'green';

export type ShellColor = 'pink' | 'white' | 'yellow';

export const shellLooks: Readonly<
  Record<ShellColor, { readonly hex: number; readonly name: string }>
> = {
  pink: { hex: 0xf08fb5, name: 'rosa' },
  white: { hex: 0xf4f1ea, name: 'brancas' },
  yellow: { hex: 0xffc93c, name: 'amarelas' },
};

const shellColors: readonly ShellColor[] = ['pink', 'white', 'yellow'];
const SHELLS = 8;

export interface ShellRound {
  readonly shells: readonly ShellColor[];
  readonly asked: ShellColor;
  readonly answer: number;
  readonly options: readonly number[];
}

/** Shells on the sand, and one question: how many of this color? */
export function shellRound(random: Random): ShellRound {
  const asked = pick(random, shellColors);
  const answer = randomInt(random, 2, 5);
  const others = shellColors.filter((color) => color !== asked);
  const shells = shuffled(random, [
    ...Array.from({ length: answer }, () => asked),
    ...Array.from({ length: SHELLS - answer }, () => pick(random, others)),
  ]);
  const options = shuffled(random, [answer, answer + 1, answer > 2 ? answer - 1 : answer + 2]);
  return { shells, asked, answer, options };
}

export const CASTLE_TOWERS = 3;
export const KIOSK_PRICE = 300;
export const BEACH_WALLET: readonly number[] = [200, 100, 100];
