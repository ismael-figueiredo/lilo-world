import type { Word } from '@domain/learning/challenge';

/**
 * Everyday words in Brazilian Portuguese, each with a picture the child knows.
 * Capital letters, as in early literacy. Pictures are emoji until ARASAAC
 * pictograms are added. Avoid words starting with letters that sound alike at
 * this stage (C/K/Q, S/Z, X).
 */
export const words: readonly Word[] = [
  { text: 'BOLA', pictogram: '⚽' },
  { text: 'GATO', pictogram: '🐱' },
  { text: 'PATO', pictogram: '🦆' },
  { text: 'MAÇÃ', pictogram: '🍎' },
  { text: 'UVA', pictogram: '🍇' },
  { text: 'SOL', pictogram: '☀️' },
  { text: 'LUA', pictogram: '🌙' },
  { text: 'PEIXE', pictogram: '🐟' },
  { text: 'FLOR', pictogram: '🌸' },
  { text: 'DADO', pictogram: '🎲' },
  { text: 'TREM', pictogram: '🚂' },
  { text: 'NAVIO', pictogram: '🚢' },
  { text: 'RATO', pictogram: '🐭' },
  { text: 'VACA', pictogram: '🐮' },
  { text: 'ABELHA', pictogram: '🐝' },
  { text: 'OVO', pictogram: '🥚' },
  { text: 'LEÃO', pictogram: '🦁' },
  { text: 'MACACO', pictogram: '🐵' },
  { text: 'BANANA', pictogram: '🍌' },
  { text: 'PÃO', pictogram: '🍞' },
  { text: 'JACARÉ', pictogram: '🐊' },
  { text: 'TOMATE', pictogram: '🍅' },
  { text: 'ESTRELA', pictogram: '⭐' },
];
