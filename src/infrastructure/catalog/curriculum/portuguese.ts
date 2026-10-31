import { findLetter, readWord, wordFirstLetter } from '@domain/activity/generators';
import {
  chooseArticle,
  findRhyme,
  findVowel,
  firstSyllable,
  orderSentence,
  orderSyllables,
  pluralWord,
  type CountableWord,
  type RhymeWord,
} from '@domain/activity/language-generators';
import { skill, type SkillDefinition } from '@domain/curriculum/skill';

const track = 'portuguese';
const station = 'letters';
const games = ['fishing', 'workshop'] as const;
const interaction = 'tap';

const rhymes: readonly (readonly RhymeWord[])[] = [
  [
    { name: 'gato', pictogram: '🐱' },
    { name: 'pato', pictogram: '🦆' },
    { name: 'rato', pictogram: '🐭' },
  ],
  [
    { name: 'pão', pictogram: '🍞' },
    { name: 'mão', pictogram: '✋' },
    { name: 'cão', pictogram: '🐶' },
    { name: 'leão', pictogram: '🦁' },
  ],
  [
    { name: 'estrela', pictogram: '⭐' },
    { name: 'janela', pictogram: '🪟' },
    { name: 'vela', pictogram: '🕯️' },
  ],
  [
    { name: 'cadeira', pictogram: '🪑' },
    { name: 'bandeira', pictogram: '🚩' },
    { name: 'mamadeira', pictogram: '🍼' },
  ],
  [
    { name: 'bola', pictogram: '⚽' },
    { name: 'escola', pictogram: '🏫' },
  ],
];

const countable: readonly CountableWord[] = [
  { singular: 'o gato', plural: 'gatos', pictogram: '🐱' },
  { singular: 'a bola', plural: 'bolas', pictogram: '⚽' },
  { singular: 'a flor', plural: 'flores', pictogram: '🌸', thing: 'flower' },
  { singular: 'o peixe', plural: 'peixes', pictogram: '🐟', thing: 'fish' },
  { singular: 'a maçã', plural: 'maçãs', pictogram: '🍎', thing: 'apple' },
  { singular: 'o carro', plural: 'carros', pictogram: '🚗', thing: 'car' },
  { singular: 'a estrela', plural: 'estrelas', pictogram: '⭐', thing: 'star' },
  { singular: 'o balão', plural: 'balões', pictogram: '🎈', thing: 'balloon' },
];

const sentences: readonly string[] = [
  'O GATO BEBE LEITE',
  'A MENINA CHUTA A BOLA',
  'O MENINO COME PÃO',
  'A VACA DÁ LEITE',
  'O SOL ESTÁ QUENTE',
  'EU GOSTO DE BRINCAR',
];

/** Trails P1 to P8 grow here. The order is a proposal, to be reviewed by a speech therapist. */
export const portuguese: readonly SkillDefinition[] = [
  skill('pt.letter.find', {
    name: 'Achar a letra',
    track,
    station,
    level: 1,
    interaction,
    games,
    activity: findLetter({ options: 3 }),
  }),
  skill('pt.letter.first', {
    name: 'Letra inicial',
    requires: ['pt.letter.find'],
    track,
    station,
    level: 1,
    interaction,
    games,
    activity: wordFirstLetter({ options: 3 }),
  }),
  skill('pt.letter.find.more', {
    name: 'Achar a letra entre 4',
    requires: ['pt.letter.find'],
    track,
    station,
    level: 2,
    interaction,
    games,
    activity: findLetter({ options: 4 }),
  }),
  skill('pt.letter.first.more', {
    name: 'Letra inicial entre 4',
    requires: ['pt.letter.first'],
    track,
    station,
    level: 2,
    interaction,
    games,
    activity: wordFirstLetter({ options: 4 }),
  }),
  skill('pt.word.read', {
    name: 'Ler a palavra',
    requires: ['pt.letter.first.more'],
    track,
    station,
    level: 3,
    interaction,
    games,
    activity: readWord({ options: 3 }),
  }),
  skill('pt.vowel', {
    name: 'Vogais',
    requires: ['pt.letter.find'],
    track,
    station,
    level: 1,
    interaction,
    games,
    activity: findVowel({ options: 3 }),
  }),
  skill('pt.syllable.order', {
    name: 'Montar a palavra',
    requires: ['pt.letter.first'],
    track,
    station,
    level: 2,
    interaction: 'order',
    games,
    activity: orderSyllables,
  }),
  skill('pt.syllable.first', {
    name: 'Completar a sílaba',
    requires: ['pt.syllable.order'],
    track,
    station,
    level: 2,
    interaction,
    games,
    activity: firstSyllable({ options: 3 }),
  }),
  skill('pt.article', {
    name: 'O ou A',
    requires: ['pt.syllable.first'],
    track,
    station,
    level: 2,
    interaction,
    games,
    activity: chooseArticle({ words: countable }),
  }),
  skill('pt.rhyme', {
    name: 'Rimas',
    requires: ['pt.syllable.first'],
    track,
    station,
    level: 3,
    interaction,
    games,
    activity: findRhyme({ sets: rhymes, options: 3 }),
  }),
  skill('pt.plural', {
    name: 'Um ou muitos',
    requires: ['pt.article'],
    track,
    station,
    level: 3,
    interaction,
    games,
    activity: pluralWord({ words: countable }),
  }),
  skill('pt.sentence', {
    name: 'Montar a frase',
    requires: ['pt.word.read'],
    track,
    station,
    level: 3,
    interaction: 'order',
    games,
    activity: orderSentence({ sentences }),
  }),
];
