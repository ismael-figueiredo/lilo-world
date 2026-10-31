import { word, type Word } from '@domain/language/word';

/**
 * Everyday words in Brazilian Portuguese, each with a picture the child knows.
 * Spelled in syllables, then by sounds (x is the sound of CH, ã and õ are nasal).
 * Avoid first letters that sound alike at this stage (C/K/Q, S/Z, X).
 */
export const wordBank: readonly Word[] = [
  word('BO-LA', 'b-o-l-a', '⚽', ['toys']),
  word('GA-TO', 'g-a-t-o', '🐱', ['animals']),
  word('PA-TO', 'p-a-t-o', '🦆', ['animals']),
  word('MA-ÇÃ', 'm-a-s-ã', '🍎', ['food']),
  word('U-VA', 'u-v-a', '🍇', ['food']),
  word('SOL', 's-o-l', '☀️', ['nature']),
  word('LU-A', 'l-u-a', '🌙', ['nature']),
  word('PEI-XE', 'p-e-i-x-e', '🐟', ['animals']),
  word('FLOR', 'f-l-o-r', '🌸', ['nature']),
  word('DA-DO', 'd-a-d-o', '🎲', ['toys']),
  word('TREM', 't-r-ẽ', '🚂', ['vehicles']),
  word('NA-VI-O', 'n-a-v-i-o', '🚢', ['vehicles']),
  word('RA-TO', 'r-a-t-o', '🐭', ['animals']),
  word('VA-CA', 'v-a-k-a', '🐮', ['animals']),
  word('A-BE-LHA', 'a-b-e-lh-a', '🐝', ['animals']),
  word('O-VO', 'o-v-o', '🥚', ['food']),
  word('LE-ÃO', 'l-e-ãu', '🦁', ['animals']),
  word('MA-CA-CO', 'm-a-k-a-k-o', '🐵', ['animals']),
  word('BA-NA-NA', 'b-a-n-ã-n-a', '🍌', ['food']),
  word('PÃO', 'p-ãu', '🍞', ['food']),
  word('JA-CA-RÉ', 'j-a-k-a-r-é', '🐊', ['animals']),
  word('TO-MA-TE', 't-o-m-a-t-e', '🍅', ['food']),
  word('ES-TRE-LA', 'e-s-t-r-e-l-a', '⭐', ['nature']),
];
