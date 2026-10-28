export type AvatarId = string;

export type AvatarKind = 'kid' | 'animal' | 'robot';

/** A character the child can play as. */
export interface AvatarDefinition {
  readonly id: AvatarId;
  readonly name: string;
  readonly kind: AvatarKind;
  /** Whether body and detail colors from the wardrobe can be applied. */
  readonly recolorable: boolean;
}
