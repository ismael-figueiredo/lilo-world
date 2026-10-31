import type { ChildLook, GuardianId, OutfitId } from '@domain/avatar/child';
import { hairColors, skinTones } from '@domain/avatar/child';
import { outfitClothes, type Build, type Clothes } from '@presentation/actors/child-figure';

/** Everything needed to build someone. */
export interface PersonLook {
  readonly look: ChildLook;
  readonly clothes: Clothes;
  readonly build: Build;
}

export const childPerson = (look: ChildLook, outfit: OutfitId): PersonLook => ({
  look,
  clothes: outfitClothes[outfit],
  build: 'child',
});

const swatch = (list: readonly { readonly color: number }[], index: number): number =>
  list[index]?.color ?? 0;

const skin = (index: number): number => swatch(skinTones, index);
const hair = (index: number): number => swatch(hairColors, index);
const BROWN_EYES = 0x4a2c17;
const GREY_HAIR = 0xb9b6b0;

const clothes = (top: number, bottom: number, shoes: number): Clothes => ({
  top,
  bottom,
  shoes,
  longSleeves: true,
  longPants: true,
});

type Role = 'girl' | 'boy';

const adult = (
  gender: Role,
  skinIndex: number,
  hairColor: number,
  hairStyle: ChildLook['hairStyle'],
  wears: Clothes,
): PersonLook => ({
  look: { gender, skin: skin(skinIndex), hair: hairColor, hairStyle, eyes: BROWN_EYES },
  clothes: wears,
  build: 'adult',
});

const classmate = (
  gender: Role,
  skinIndex: number,
  hairColor: number,
  hairStyle: ChildLook['hairStyle'],
): PersonLook => ({
  look: { gender, skin: skin(skinIndex), hair: hairColor, hairStyle, eyes: BROWN_EYES },
  clothes: outfitClothes.school,
  build: 'child',
});

/** The people of the town: all made from one body, so they cost no download. */
export const cast = {
  teacher: adult('girl', 4, hair(1), 'bun', clothes(0x8a5fc4, 0x3f4a63, 0x5a4030)),
  cashier: adult('girl', 2, hair(3), 'long', clothes(0xd8483b, 0x2f3a52, 0x33333d)),
  driver: adult('boy', 5, hair(0), 'buzz', clothes(0x2f6fb5, 0x2b3550, 0x33333d)),
  gardener: adult('boy', 1, GREY_HAIR, 'short', clothes(0x4f9a56, 0x7a5a3a, 0x5a4030)),
  neighbor: adult('girl', 6, hair(0), 'afro', clothes(0xe8a93a, 0x6a4a8a, 0xf4f1ea)),
  walker: adult('boy', 3, hair(2), 'short', clothes(0x3d8fa8, 0x4a4f63, 0x5a4030)),
  student: adult('girl', 0, hair(3), 'pigtails', clothes(0xd86fa0, 0x39507a, 0xf4f1ea)),
  classmateAna: classmate('girl', 5, hair(0), 'braids'),
  classmateTeo: classmate('boy', 1, hair(4), 'short'),
  classmateJu: classmate('girl', 3, hair(1), 'curly'),
} as const satisfies Readonly<Record<string, PersonLook>>;

export type CastMember = keyof typeof cast;

interface GuardianLook {
  readonly gender: Role;
  readonly hairStyle: ChildLook['hairStyle'];
  readonly grey: boolean;
  readonly top: number;
}

const guardianLooks: Readonly<Record<GuardianId, GuardianLook>> = {
  mother: { gender: 'girl', hairStyle: 'long', grey: false, top: 0x3cae9a },
  father: { gender: 'boy', hairStyle: 'short', grey: false, top: 0x4a7fc4 },
  grandmother: { gender: 'girl', hairStyle: 'bun', grey: true, top: 0xb3679b },
  grandfather: { gender: 'boy', hairStyle: 'buzz', grey: true, top: 0x8a7a55 },
  aunt: { gender: 'girl', hairStyle: 'curly', grey: false, top: 0xe0793f },
  uncle: { gender: 'boy', hairStyle: 'short', grey: false, top: 0x5a8a4a },
};

/** The adult at home looks like family: same skin, same hair color, same eyes. */
export function guardianPerson(guardian: GuardianId, child: ChildLook): PersonLook {
  const { gender, hairStyle, grey, top } = guardianLooks[guardian];
  return {
    look: { ...child, gender, hairStyle, hair: grey ? GREY_HAIR : child.hair },
    clothes: clothes(top, 0x3f4a63, 0x5a4030),
    build: 'adult',
  };
}
