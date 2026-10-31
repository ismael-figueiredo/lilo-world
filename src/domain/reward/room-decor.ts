export type DecorId = 'poster' | 'plant' | 'stars' | 'pillow';

export interface Decor {
  readonly id: DecorId;
  readonly name: string;
  readonly icon: string;
  /** In golden coins, earned by playing. There are no real purchases in this game. */
  readonly price: number;
}

export const decorItems: readonly Decor[] = [
  { id: 'poster', name: 'Quadro', icon: '🖼️', price: 10 },
  { id: 'plant', name: 'Plantinha', icon: '🪴', price: 15 },
  { id: 'pillow', name: 'Almofada', icon: '🛋️', price: 20 },
  { id: 'stars', name: 'Estrelas na parede', icon: '🌟', price: 30 },
];

export const isDecor = (id: string): id is DecorId => decorItems.some((item) => item.id === id);

export const decorOf = (id: DecorId): Decor => {
  const found = decorItems.find((item) => item.id === id);
  if (found === undefined) throw new Error(`No decor ${id}`);
  return found;
};
