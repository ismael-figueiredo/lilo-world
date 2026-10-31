import type { Cents } from '@domain/money/money';

export type GroceryId =
  | 'rice'
  | 'beans'
  | 'onion'
  | 'tomato'
  | 'pasta'
  | 'cheese'
  | 'carrot'
  | 'potato'
  | 'eggs'
  | 'milk'
  | 'bread';

export interface Grocery {
  readonly id: GroceryId;
  /** With its article, as the voice says it. */
  readonly name: string;
  readonly short: string;
  readonly icon: string;
  readonly price: Cents;
}

export const groceries: readonly Grocery[] = [
  { id: 'rice', name: 'o arroz', short: 'Arroz', icon: '🍚', price: 500 },
  { id: 'beans', name: 'o feijão', short: 'Feijão', icon: '🫘', price: 400 },
  { id: 'onion', name: 'a cebola', short: 'Cebola', icon: '🧅', price: 200 },
  { id: 'tomato', name: 'o tomate', short: 'Tomate', icon: '🍅', price: 300 },
  { id: 'pasta', name: 'o macarrão', short: 'Macarrão', icon: '🍝', price: 400 },
  { id: 'cheese', name: 'o queijo', short: 'Queijo', icon: '🧀', price: 600 },
  { id: 'carrot', name: 'a cenoura', short: 'Cenoura', icon: '🥕', price: 200 },
  { id: 'potato', name: 'a batata', short: 'Batata', icon: '🥔', price: 300 },
  { id: 'eggs', name: 'os ovos', short: 'Ovos', icon: '🥚', price: 500 },
  { id: 'milk', name: 'o leite', short: 'Leite', icon: '🥛', price: 400 },
  { id: 'bread', name: 'o pão', short: 'Pão', icon: '🍞', price: 300 },
];

export const groceryOf = (id: GroceryId): Grocery => {
  const grocery = groceries.find((candidate) => candidate.id === id);
  if (grocery === undefined) throw new Error(`No grocery ${id}`);
  return grocery;
};

export type RecipeId = 'rice-beans' | 'pasta' | 'soup' | 'omelet' | 'sandwich';

export interface Recipe {
  readonly id: RecipeId;
  readonly name: string;
  readonly icon: string;
  /** Everything it takes: something of it is always missing at home. */
  readonly needs: readonly GroceryId[];
  /** Bought at the bakery, by asking, and not on the market's shelves. */
  readonly bakery?: boolean;
}

export const recipes: readonly Recipe[] = [
  { id: 'rice-beans', name: 'arroz com feijão', icon: '🍛', needs: ['rice', 'beans', 'onion'] },
  { id: 'pasta', name: 'macarrão com tomate', icon: '🍝', needs: ['pasta', 'tomato', 'cheese'] },
  { id: 'soup', name: 'sopa de legumes', icon: '🍲', needs: ['carrot', 'potato', 'onion'] },
  { id: 'omelet', name: 'omelete', icon: '🍳', needs: ['eggs', 'cheese', 'tomato'] },
  { id: 'sandwich', name: 'sanduíche', icon: '🥪', needs: ['bread', 'cheese'], bakery: true },
];

export const recipeOf = (id: RecipeId): Recipe => {
  const recipe = recipes.find((candidate) => candidate.id === id);
  if (recipe === undefined) throw new Error(`No recipe ${id}`);
  return recipe;
};
