import type { SkillStatus } from '@domain/curriculum/mastery';
import type { SkillDefinition, SkillId, Track } from '@domain/curriculum/skill';

/** warm-up: already known; learn: the new thing; play: review or something else. */
export type ActivityRole = 'warm-up' | 'learn' | 'play';

export interface PlannedActivity {
  readonly skill: SkillDefinition;
  readonly role: ActivityRole;
  /** Questions in this activity. */
  readonly length: number;
  /** Never played: it starts by showing how it is done. */
  readonly isNew: boolean;
}

/** Set by an adult for one skill. */
export type SkillChoice = 'pin' | 'hide';

/**
 * How hard a track goes, set by an adult. `gentle` has shorter activities;
 * `ahead` offers skills without waiting for the ones before them.
 */
export type Pace = 'gentle' | 'normal' | 'ahead';

export const paces: readonly Pace[] = ['gentle', 'normal', 'ahead'];

export interface PlanInput {
  readonly skills: readonly SkillDefinition[];
  readonly statusOf: (id: SkillId) => SkillStatus;
  readonly choices?: Readonly<Record<SkillId, SkillChoice>>;
  readonly pace?: Readonly<Partial<Record<Track, Pace>>>;
}

const LENGTHS: Readonly<Record<ActivityRole, number>> = { 'warm-up': 4, learn: 5, play: 4 };
const GENTLE_LENGTH = 3;
export const MAX_ACTIVITIES = 3;

/**
 * Three short activities: something known, something new and something to
 * play, from different tracks whenever there are. Pure and deterministic: the
 * same progress gives the same plan, so a day never starts with a surprise.
 */
export function planSession({
  skills,
  statusOf,
  choices = {},
  pace = {},
}: PlanInput): PlannedActivity[] {
  const offered = skills.filter((skill) => choices[skill.id] !== 'hide');
  const isKnown = (id: SkillId) => ['mastered', 'review'].includes(statusOf(id));
  // A hidden requirement must not lock everything after it.
  const isOpen = (skill: SkillDefinition) =>
    pace[skill.track] === 'ahead' ||
    skill.requires.every((id) => choices[id] === 'hide' || isKnown(id));
  const learnable = offered
    .filter((skill) => !isKnown(skill.id) && isOpen(skill))
    .sort((a, b) => Number(choices[b.id] === 'pin') - Number(choices[a.id] === 'pin'));
  const reviews = offered.filter((skill) => statusOf(skill.id) === 'review');
  const known = offered.filter((skill) => isKnown(skill.id));
  // Never something still locked, even when there is little left to offer.
  const available = offered.filter((skill) => isKnown(skill.id) || isOpen(skill));

  const warmUp = reviews[0] ?? known[0] ?? learnable[0];
  if (warmUp === undefined) return [];

  const used = new Set([warmUp.id]);
  const unused = (skill: SkillDefinition) => !used.has(skill.id);
  const otherTrack = (skill: SkillDefinition) => skill.track !== warmUp.track;

  const learn =
    learnable.find((skill) => unused(skill) && otherTrack(skill)) ??
    available.find((skill) => unused(skill) && otherTrack(skill)) ??
    learnable.find(unused);
  const planned = (skill: SkillDefinition, role: ActivityRole): PlannedActivity => ({
    skill,
    role,
    length: pace[skill.track] === 'gentle' ? GENTLE_LENGTH : LENGTHS[role],
    isNew: statusOf(skill.id) === 'new',
  });
  if (learn === undefined) return [planned(warmUp, 'warm-up')];
  used.add(learn.id);

  const differentPlay = (skill: SkillDefinition) =>
    unused(skill) && skill.interaction !== learn.interaction;
  const thirdTrack = (skill: SkillDefinition) =>
    differentPlay(skill) && otherTrack(skill) && skill.track !== learn.track;
  const play =
    reviews.find(differentPlay) ??
    learnable.find(thirdTrack) ??
    learnable.find(differentPlay) ??
    available.find(differentPlay) ??
    reviews.find(unused) ??
    available.find(unused);
  if (play === undefined) return [planned(warmUp, 'warm-up'), planned(learn, 'learn')];

  // The same way of playing never comes twice in a row, when there is another.
  return warmUp.interaction === learn.interaction
    ? [planned(warmUp, 'warm-up'), planned(play, 'play'), planned(learn, 'learn')]
    : [planned(warmUp, 'warm-up'), planned(learn, 'learn'), planned(play, 'play')];
}
