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
