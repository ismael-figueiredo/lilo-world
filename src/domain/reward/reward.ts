/** What a mission gives back: coins buy wardrobe items, stars unlock worlds. */
export interface Reward {
  readonly coins: number;
  readonly stars: number;
}

export const noReward: Reward = { coins: 0, stars: 0 };
