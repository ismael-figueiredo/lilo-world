import type { ActivityBuilder, InteractionKind } from '@domain/activity/activity';

/** A subject practiced at the desk. Its level is what saves keep. */
export type Station = 'letters' | 'numbers' | 'coins' | 'world';

export const stations: readonly Station[] = ['letters', 'numbers', 'coins', 'world'];

/** Levels per subject. Each new level gives a sticker and a star. */
export const MAX_LEVEL = 3;

export type SkillId = string;
export type Track = 'portuguese' | 'math' | 'knowledge';

export const tracks: readonly Track[] = ['portuguese', 'math', 'knowledge'];

/** The fantasy around an activity. The skill stays the same whichever one is used. */
export type GameId = 'fishing' | 'workshop' | 'garden' | 'shop' | 'explorer';

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
