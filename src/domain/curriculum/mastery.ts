import { DAY_MS, nextReviewStep, reviewAt } from '@domain/curriculum/review-schedule';

/** How many of the latest answers decide if a skill is mastered. */
export const MASTERY_WINDOW = 8;
export const MASTERY_RATE = 0.8;
/** One good day can be luck: mastery needs at least this many different days. */
export const MASTERY_DAYS = 2;
/** With fewer right answers than this among the latest, an adult may want to help. */
const HELP_RATE = 0.5;
const HELP_WINDOW = 4;

/** The story of one skill for one child. Plain data, stored with the progress. */
export interface SkillRecord {
  /** Latest answers, oldest first; true when right on the first try. */
  readonly recent: readonly boolean[];
  /** Different days practiced (latest ones). */
  readonly days: readonly number[];
  /** Epoch milliseconds, 0 while not mastered. */
  readonly masteredAt: number;
  readonly reviewStep: number;
  readonly nextReviewAt: number;
}

export type SkillStatus = 'new' | 'practicing' | 'mastered' | 'review';

export const emptyRecord: SkillRecord = {
  recent: [],
  days: [],
  masteredAt: 0,
  reviewStep: 0,
  nextReviewAt: 0,
};

const hits = (recent: readonly boolean[]): number => recent.filter(Boolean).length;

export function recordAnswer(record: SkillRecord, firstTry: boolean, now: number): SkillRecord {
  const recent = [...record.recent, firstTry].slice(-MASTERY_WINDOW);
  const day = Math.floor(now / DAY_MS);
  const days = record.days.includes(day)
    ? record.days
    : [...record.days, day].slice(-MASTERY_WINDOW);

  if (record.masteredAt === 0) {
    const mastered =
      recent.length >= MASTERY_WINDOW &&
      hits(recent) / recent.length >= MASTERY_RATE &&
      days.length >= MASTERY_DAYS;
    return mastered
      ? { recent, days, masteredAt: now, reviewStep: 0, nextReviewAt: reviewAt(now, 0) }
      : { ...record, recent, days };
  }
  // A review is decided by its first answer: the next date then moves ahead.
  if (now < record.nextReviewAt) return { ...record, recent, days };
  const reviewStep = nextReviewStep(record.reviewStep, firstTry);
  return { ...record, recent, days, reviewStep, nextReviewAt: reviewAt(now, reviewStep) };
}

export function skillStatus(record: SkillRecord | undefined, now: number): SkillStatus {
  if (record === undefined || record.recent.length === 0) return 'new';
  if (record.masteredAt === 0) return 'practicing';
  return now >= record.nextReviewAt ? 'review' : 'mastered';
}

/** For adults only: the child never sees this. */
export const needsHelp = (record: SkillRecord | undefined): boolean => {
  if (record === undefined || record.recent.length < HELP_WINDOW) return false;
  const latest = record.recent.slice(-HELP_WINDOW);
  return hits(latest) / latest.length < HELP_RATE;
};

const finite = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Returns undefined for broken data: the skill then simply starts over. */
export function sanitizeRecord(raw: unknown): SkillRecord | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.recent) || !Array.isArray(data.days)) return undefined;
  return {
    recent: data.recent.filter((value): value is boolean => typeof value === 'boolean'),
    days: data.days.filter((value): value is number => typeof value === 'number'),
    masteredAt: finite(data.masteredAt),
    reviewStep: finite(data.reviewStep),
    nextReviewAt: finite(data.nextReviewAt),
  };
}
