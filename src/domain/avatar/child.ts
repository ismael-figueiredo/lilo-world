/** The avatar that is the child itself; every other avatar is a costume. */
export const CHILD_AVATAR_ID = 'child';

export type Gender = 'girl' | 'boy' | 'neutral';

export type HairStyle =
  'short' | 'buzz' | 'curly' | 'afro' | 'long' | 'pigtails' | 'braids' | 'bun';

/** Who the child is: what stays the same whatever they wear. */
export interface ChildLook {
  readonly gender: Gender;
  readonly skin: number;
  readonly hair: number;
  readonly hairStyle: HairStyle;
  readonly eyes: number;
}

export type GuardianId = 'mother' | 'father' | 'grandmother' | 'grandfather' | 'aunt' | 'uncle';

export type OutfitId = 'pajamas' | 'home' | 'school' | 'coat' | 'raincoat' | 'summer' | 'swim';

/** What each child chose. Families are different, so the adult at home is a choice too. */
export interface ChildChoices {
  readonly look: ChildLook;
  readonly guardian: GuardianId;
  readonly outfit: OutfitId;
}

export interface Swatch {
  readonly name: string;
  readonly color: number;
}

export const skinTones: readonly Swatch[] = [
  { name: 'Muito clara', color: 0xf7d9c4 },
  { name: 'Clara', color: 0xeec1a0 },
  { name: 'Média', color: 0xd9a077 },
  { name: 'Morena', color: 0xc68a5e },
  { name: 'Morena escura', color: 0x9a6340 },
  { name: 'Escura', color: 0x6e432a },
  { name: 'Muito escura', color: 0x4a2c1c },
];

export const hairColors: readonly Swatch[] = [
  { name: 'Preto', color: 0x1f1714 },
  { name: 'Castanho escuro', color: 0x3f2a1c },
  { name: 'Castanho', color: 0x6b4427 },
  { name: 'Ruivo', color: 0xb5532a },
  { name: 'Loiro', color: 0xe0b45c },
  { name: 'Azul', color: 0x3f7fd6 },
  { name: 'Rosa', color: 0xe86aa6 },
];

export const eyeColors: readonly Swatch[] = [
  { name: 'Castanho', color: 0x4a2c17 },
  { name: 'Preto', color: 0x241a16 },
  { name: 'Verde', color: 0x4f8a4a },
  { name: 'Azul', color: 0x3d7fc4 },
  { name: 'Mel', color: 0xa87432 },
];

export const hairStyles: readonly { readonly id: HairStyle; readonly name: string }[] = [
  { id: 'short', name: 'Curto' },
  { id: 'buzz', name: 'Bem curto' },
  { id: 'curly', name: 'Cacheado' },
  { id: 'afro', name: 'Black' },
  { id: 'long', name: 'Comprido' },
  { id: 'pigtails', name: 'Maria-chiquinha' },
  { id: 'braids', name: 'Tranças' },
  { id: 'bun', name: 'Coque' },
];

export const genders: readonly { readonly id: Gender; readonly name: string }[] = [
  { id: 'girl', name: 'Menina' },
  { id: 'boy', name: 'Menino' },
  { id: 'neutral', name: 'Criança' },
];

export const guardians: readonly { readonly id: GuardianId; readonly name: string }[] = [
  { id: 'mother', name: 'Mãe' },
  { id: 'father', name: 'Pai' },
  { id: 'grandmother', name: 'Avó' },
  { id: 'grandfather', name: 'Avô' },
  { id: 'aunt', name: 'Tia' },
  { id: 'uncle', name: 'Tio' },
];

export const outfits: readonly { readonly id: OutfitId; readonly name: string }[] = [
  { id: 'home', name: 'Roupa de casa' },
  { id: 'pajamas', name: 'Pijama' },
  { id: 'school', name: 'Uniforme' },
  { id: 'coat', name: 'Casaco' },
  { id: 'raincoat', name: 'Capa de chuva' },
  { id: 'summer', name: 'Bermuda' },
  { id: 'swim', name: 'Roupa de banho' },
];

export const defaultChildChoices: ChildChoices = {
  look: {
    gender: 'neutral',
    skin: 0xc68a5e,
    hair: 0x3f2a1c,
    hairStyle: 'short',
    eyes: 0x4a2c17,
  },
  guardian: 'mother',
  outfit: 'home',
};

const oneOf = <T>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

const ids = <T>(options: readonly { readonly id: T }[]): readonly T[] => options.map((o) => o.id);
const colors = (options: readonly Swatch[]): readonly number[] => options.map((o) => o.color);

/**
 * Whatever was saved, the child gets a complete, valid set of choices: profiles
 * from before the child creator, or a broken save, simply start from the default.
 */
export function completeChildChoices(saved: Readonly<Record<string, unknown>>): ChildChoices {
  const fallback = defaultChildChoices;
  const look = (typeof saved.look === 'object' && saved.look !== null ? saved.look : {}) as Record<
    string,
    unknown
  >;
  return {
    look: {
      gender: oneOf(look.gender, ids(genders), fallback.look.gender),
      skin: oneOf(look.skin, colors(skinTones), fallback.look.skin),
      hair: oneOf(look.hair, colors(hairColors), fallback.look.hair),
      hairStyle: oneOf(look.hairStyle, ids(hairStyles), fallback.look.hairStyle),
      eyes: oneOf(look.eyes, colors(eyeColors), fallback.look.eyes),
    },
    guardian: oneOf(saved.guardian, ids(guardians), fallback.guardian),
    outfit: oneOf(saved.outfit, ids(outfits), fallback.outfit),
  };
}
