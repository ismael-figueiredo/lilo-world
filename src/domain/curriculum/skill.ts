import type { ActivityBuilder, InteractionKind } from '@domain/activity/activity';

/** A place in the world where skills are practiced. Its level is what saves keep. */
export type Station = 'letters' | 'numbers' | 'coins';

export const stations: readonly Station[] = ['letters', 'numbers', 'coins'];

/** Levels per station. Each new level gives a sticker and a star. */
export const MAX_LEVEL = 3;

export type SkillId = string;
export type Track = 'portuguese' | 'math';

/** The fantasy around an activity. The skill stays the same whichever one is used. */
export type GameId = 'fishing' | 'workshop' | 'garden' | 'shop';

/** What the child learns. How it is played lives in `activity`. */
export interface SkillDefinition {
  readonly id: SkillId;
  readonly name: string;
  readonly track: Track;
  /** Skills mastered before this one is offered as new. */
  readonly requires: readonly SkillId[];
  readonly station: Station;
  readonly level: number;
  readonly interaction: InteractionKind;
  readonly games: readonly GameId[];
  readonly activity: ActivityBuilder;
}

/** A skill is one entry of data: `skill('math.count.5', { name, track, ... })`. */
export const skill = (
  id: SkillId,
  definition: Omit<SkillDefinition, 'id' | 'requires'> & { requires?: readonly SkillId[] },
): SkillDefinition => ({ ...definition, id, requires: definition.requires ?? [] });

/** The skills practiced at a station's level, mixed in the same round. */
export const skillsAt = (
  skills: readonly SkillDefinition[],
  station: Station,
  level: number,
): readonly SkillDefinition[] =>
  skills.filter((candidate) => candidate.station === station && candidate.level === level);
