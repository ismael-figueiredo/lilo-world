/** Toy reais, always in cents: never a fraction, so sums are always exact. */
export type Cents = number;

/** Coins and notes that exist in the game, from the smallest. */
export const pieces: readonly Cents[] = [50, 100, 200, 500, 1000, 2000, 5000];

export const isPiece = (value: unknown): value is Cents => pieces.includes(value as Cents);

export const isCoin = (piece: Cents): boolean => piece <= 100;

export const total = (values: readonly Cents[]): Cents =>
  values.reduce((sum, value) => sum + value, 0);

/** R$ 7 or R$ 7,50, as a price tag says it. */
export function written(amount: Cents): string {
  const reais = Math.floor(amount / 100);
  const cents = amount % 100;
  return cents === 0 ? `R$ ${reais}` : `R$ ${reais},${String(cents).padStart(2, '0')}`;
}

/** 7 reais and 50 centavos, as the voice says it. */
export function spoken(amount: Cents): string {
  const reais = Math.floor(amount / 100);
  const cents = amount % 100;
  const whole = `${reais} ${reais === 1 ? 'real' : 'reais'}`;
  if (cents === 0) return whole;
  return reais === 0 ? `${cents} centavos` : `${whole} e ${cents} centavos`;
}

/** An amount in the fewest coins and notes, as a cashier would give it. */
export function fewestPieces(amount: Cents): Cents[] {
  const given: Cents[] = [];
  let left = amount;
  for (const piece of [...pieces].reverse()) {
    while (left >= piece) {
      given.push(piece);
      left -= piece;
    }
  }
  return given;
}

/** The smallest note that pays for it all at once. */
export const noteFor = (amount: Cents): Cents =>
  pieces.find((piece) => piece >= amount && !isCoin(piece)) ?? 5000;

/** The change of a payment; undefined while the money does not reach the price. */
export const changeFor = (paid: Cents, price: Cents): Cents | undefined =>
  paid >= price ? paid - price : undefined;

/** Takes what was paid out of the wallet, piece by piece. */
export function withoutPieces(wallet: readonly Cents[], paid: readonly Cents[]): Cents[] {
  const left = [...wallet];
  for (const piece of paid) {
    const index = left.indexOf(piece);
    if (index >= 0) left.splice(index, 1);
  }
  return left;
}
