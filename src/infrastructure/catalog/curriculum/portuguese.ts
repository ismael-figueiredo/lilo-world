import { findLetter, readWord, wordFirstLetter } from '@domain/activity/generators';
import { skill, type SkillDefinition } from '@domain/curriculum/skill';

const track = 'portuguese';
const station = 'letters';
const games = ['fishing', 'workshop'] as const;
const interaction = 'tap';

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
];
