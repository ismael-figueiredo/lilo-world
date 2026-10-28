/** Where an item goes on the character: one item per slot. */
export type WardrobeSlot = 'hat' | 'body' | 'trim' | 'accessory';

/** How an item looks. The presentation layer decides how each look is drawn. */
export type WardrobeLook =
  'color' | 'cap' | 'party-hat' | 'crown' | 'beanie' | 'glasses' | 'backpack' | 'headphones';

export type WardrobeItemId = string;

export interface WardrobeItem {
  readonly id: WardrobeItemId;
  readonly name: string;
  readonly slot: WardrobeSlot;
  readonly look: WardrobeLook;
  readonly price: number;
  /** Main color (0xRRGGBB). */
  readonly color: number;
}
