import type { SchoolStage } from '@domain/school/school-day';

/**
 * The inside of the market stands far beyond the sea, where it is never seen
 * from the island, and the game moves the child there behind a fade.
 */
export const MARKET_INTERIOR = { x: 0, z: 460 } as const;

export const MarketPlace = {
  checkout: 'market:checkout',
  door: 'market:door',
} as const;

export const ITEM_PLACE = 'market:item:';

/** Which item a place of the walkable market is. */
export const itemOfPlace = (placeId: string): string | undefined =>
  placeId.startsWith(ITEM_PLACE) ? placeId.slice(ITEM_PLACE.length) : undefined;

/** Also beyond the sea: the inside of the bus and the school building. */
export const BUS_INTERIOR = { x: -460, z: 0 } as const;
export const SCHOOL_BUILDING = { x: 0, z: -460 } as const;

/** Where each stage of the school agenda happens. */
export const schoolSpotOf: Readonly<Partial<Record<SchoolStage, string>>> = {
  greet: 'escola:teacher',
  backpack: 'escola:cubby',
  seat: 'escola:seat',
  toilet: 'escola:toilet',
  snack: 'escola:line',
  pe: 'escola:yard',
  recess: 'escola:yard',
  leave: 'escola:exit',
};
