import {
  groceryOf,
  recipeOf,
  recipes,
  type GroceryId,
  type RecipeId,
} from '@domain/errand/groceries';
import {
  changeFor,
  fewestPieces,
  isPiece,
  noteFor,
  total,
  withoutPieces,
  type Cents,
} from '@domain/money/money';

/**
 * The stages of one task, in order: the adult finds what is missing, the child
 * buys it, brings it home with the change, and they cook together.
 */
export const stages = ['ask', 'shop', 'bring', 'cook'] as const;
export type Stage = (typeof stages)[number];

/**
 * How hard the money is, following the child's math: paying the exact amount,
 * then with a note and change, then with cents.
 */
export type MoneyLevel = 'exact' | 'change' | 'cents';

export interface Errand {
  readonly stage: Stage;
  readonly recipe: RecipeId;
  readonly level: MoneyLevel;
  readonly list: readonly GroceryId[];
  /** What is already in the cart. */
  readonly picked: readonly GroceryId[];
  readonly wallet: readonly Cents[];
  /** What the cashier gave back, to hand to the adult. */
  readonly change: Cents;
}

export const emptyErrand = (recipe: RecipeId): Errand => ({
  stage: 'ask',
  recipe,
  level: 'exact',
  list: [],
  picked: [],
  wallet: [],
  change: 0,
});

const CENTS_EXTRA = 50;

export const priceOf = (id: GroceryId, level: MoneyLevel): Cents =>
  groceryOf(id).price + (level === 'cents' ? CENTS_EXTRA : 0);

export const billOf = (errand: Errand): Cents =>
  total(errand.list.map((id) => priceOf(id, errand.level)));

export const isBakeryRun = (errand: Errand): boolean => recipeOf(errand.recipe).bakery === true;

/** Today's lunch: it follows the day, so each day has its own, and it can be planned. */
export function planErrand(dayNumber: number, level: MoneyLevel): Errand {
  const recipe = recipes[(dayNumber - 1) % recipes.length] ?? recipes[0];
  if (recipe === undefined) throw new Error('No recipes');
  const start = (dayNumber - 1) % recipe.needs.length;
  const first = recipe.needs[start];
  const second = recipe.needs[(start + 1) % recipe.needs.length];
  const easy = level === 'exact' || first === undefined || second === undefined;
  // The bakery only has the bread.
  const bread: GroceryId[] = ['bread'];
  const list = recipe.bakery === true ? bread : easy ? [first ?? 'rice'] : [first, second];
  const errand = { ...emptyErrand(recipe.id), level, list };
  const bill = billOf(errand);
  // An extra coin: paying exactly means choosing, not handing everything over.
  const wallet = level === 'exact' ? [...fewestPieces(bill), 100] : [noteFor(bill)];
  return { ...errand, wallet };
}

export const nextToPick = (errand: Errand): GroceryId | undefined =>
  errand.list.find((id) => !errand.picked.includes(id));

export const allPicked = (errand: Errand): boolean => nextToPick(errand) === undefined;

export const isOnList = (errand: Errand, id: GroceryId): boolean => errand.list.includes(id);

export function advance(errand: Errand): Errand {
  const stage = stages[stages.indexOf(errand.stage) + 1];
  return stage === undefined ? errand : { ...errand, stage };
}

export function pick(errand: Errand, id: GroceryId): Errand {
  if (!isOnList(errand, id) || errand.picked.includes(id)) return errand;
  return { ...errand, picked: [...errand.picked, id] };
}

/** Paid and checked: the money that came back goes in the wallet, and off they go home. */
export function pay(errand: Errand, paid: readonly Cents[]): Errand {
  const change = changeFor(total(paid), billOf(errand));
  if (change === undefined) return errand;
  const left = withoutPieces(errand.wallet, paid);
  const back = [...left, ...fewestPieces(change)];
  return { ...errand, stage: 'bring', wallet: back, change: total(back) };
}

const stageOf = (value: unknown): Stage | undefined => stages.find((stage) => stage === value);

const levels: readonly MoneyLevel[] = ['exact', 'change', 'cents'];

/** A broken save only starts the task again: it must never stop the day. */
export function sanitizeErrand(raw: unknown): Errand | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const data = raw as Record<string, unknown>;
  const recipe = recipes.find((candidate) => candidate.id === data.recipe);
  const stage = stageOf(data.stage);
  const level = levels.find((candidate) => candidate === data.level);
  if (recipe === undefined || stage === undefined || level === undefined) return undefined;
  const ids = (value: unknown): GroceryId[] =>
    Array.isArray(value)
      ? (value as GroceryId[]).filter((id) => {
          try {
            return groceryOf(id).id === id;
          } catch {
            return false;
          }
        })
      : [];
  const wallet = Array.isArray(data.wallet) ? data.wallet.filter(isPiece) : [];
  const change = typeof data.change === 'number' && data.change >= 0 ? data.change : 0;
  return {
    stage,
    recipe: recipe.id,
    level,
    list: ids(data.list),
    picked: ids(data.picked),
    wallet,
    change,
  };
}
