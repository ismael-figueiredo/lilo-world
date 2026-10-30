import { describe, expect, it } from 'vitest';
import {
  emptyRecord,
  MASTERY_WINDOW,
  needsHelp,
  recordAnswer,
  sanitizeRecord,
  skillStatus,
  type SkillRecord,
  type SkillStatus,
} from '@domain/curriculum/mastery';
import { DAY_MS, REVIEW_DAYS } from '@domain/curriculum/review-schedule';
import { MAX_ACTIVITIES, planSession } from '@domain/curriculum/session-plan';
import type { SkillDefinition } from '@domain/curriculum/skill';
import { PlayerProgress } from '@domain/progress/player-progress';
import { wordBank } from '@infrastructure/catalog/curriculum/word-bank';
import { curriculum } from '@infrastructure/catalog/static-content-catalog';

const answers = (start: SkillRecord, count: number, firstTry: boolean, now: number) => {
  let record = start;
  for (let i = 0; i < count; i += 1) record = recordAnswer(record, firstTry, now);
  return record;
};

/** Mastered on two different days, starting at day 10. */
const mastered = (): SkillRecord =>
  answers(answers(emptyRecord, MASTERY_WINDOW - 1, true, 10 * DAY_MS), 1, true, 11 * DAY_MS);

describe('mastery', () => {
  it('starts new, then practicing', () => {
    expect(skillStatus(undefined, 0)).toBe('new');
    expect(skillStatus(recordAnswer(emptyRecord, true, 0), 0)).toBe('practicing');
  });

  it('needs enough right answers on at least two different days', () => {
    const oneDay = answers(emptyRecord, MASTERY_WINDOW, true, 10 * DAY_MS);
    expect(skillStatus(oneDay, 10 * DAY_MS)).toBe('practicing');
    expect(skillStatus(mastered(), 11 * DAY_MS)).toBe('mastered');
  });

  it('is not mastered by many mistakes', () => {
    const record = answers(answers(emptyRecord, 6, false, 0), 6, true, 3 * DAY_MS);
    expect(skillStatus(record, 3 * DAY_MS)).toBe('practicing');
  });

  it('comes back after 1, 3, 7 and 21 days while it is remembered', () => {
    let record = mastered();
    let now = 11 * DAY_MS;
    for (const days of REVIEW_DAYS) {
      now += days * DAY_MS;
      expect(skillStatus(record, now - 1)).toBe('mastered');
      expect(skillStatus(record, now)).toBe('review');
      record = recordAnswer(record, true, now);
    }
    expect(record.reviewStep).toBe(REVIEW_DAYS.length - 1);
  });

  it('goes one interval back when it was forgotten', () => {
    const now = 12 * DAY_MS;
    const remembered = recordAnswer(mastered(), true, now);
    const later = now + 3 * DAY_MS;
    const forgotten = recordAnswer(remembered, false, later);
    expect(forgotten.reviewStep).toBe(0);
    expect(forgotten.nextReviewAt).toBe(later + DAY_MS);
  });

  it('decides a review by its first answer', () => {
    const now = 12 * DAY_MS;
    const once = recordAnswer(mastered(), true, now);
    expect(recordAnswer(once, false, now).reviewStep).toBe(once.reviewStep);
  });

  it('tells adults when a child may need help', () => {
    expect(needsHelp(answers(emptyRecord, 4, false, 0))).toBe(true);
    expect(needsHelp(answers(emptyRecord, 3, false, 0))).toBe(false);
    expect(needsHelp(answers(emptyRecord, 4, true, 0))).toBe(false);
  });

  it('drops broken stored records', () => {
    expect(sanitizeRecord('nope')).toBeUndefined();
    expect(sanitizeRecord({ recent: 3 })).toBeUndefined();
    expect(sanitizeRecord({ recent: [true, 'x'], days: [1] })?.recent).toEqual([true]);
  });
});

describe('progress with skills', () => {
  it('keeps old saves whole: skills just start as new', () => {
    const old = PlayerProgress.fromSnapshot({
      coins: 7,
      stars: 2,
      ownedItemIds: [],
      equipped: {},
      completedMissionIds: [],
      skillLevels: { numbers: 3 },
      stickerIds: ['numbers-1'],
      letters: ['A'],
    });
    expect(old.levelOf('numbers')).toBe(3);
    expect(old.coins.amount).toBe(7);
    expect(old.letters).toEqual(['A']);
    expect(old.skillRecord('math.count.5')).toBeUndefined();
  });

  it('survives saving and loading', () => {
    const progress = PlayerProgress.createNew().recordSkill('math.count.5', true, 5);
    const again = PlayerProgress.fromSnapshot(progress.toSnapshot());
    expect(again.skillRecord('math.count.5')?.recent).toEqual([true]);
  });

  it('pays the prize of the day', () => {
    expect(PlayerProgress.createNew().rewardSession(5).coins.amount).toBe(5);
  });
});

describe('session plan', () => {
  const plan = (status: (skill: SkillDefinition) => SkillStatus, choices = {}) =>
    planSession({
      skills: curriculum,
      statusOf: (id) => {
        const skill = curriculum.find((s) => s.id === id);
        return skill === undefined ? 'new' : status(skill);
      },
      choices,
    });

  /** Every kind of child, from the first day to knowing it all. */
  const profiles = (): ((skill: SkillDefinition) => SkillStatus)[] =>
    Array.from({ length: 2 ** 7 }, (_, seed) => (skill: SkillDefinition) => {
      const index = curriculum.indexOf(skill);
      const pool: SkillStatus[] = ['new', 'practicing', 'mastered', 'review'];
      return pool[(seed >> (index % 6)) & 3] ?? 'new';
    });

  it('always has Portuguese and math, at most three activities and 18 questions', () => {
    for (const profile of profiles()) {
      const activities = plan(profile);
      expect(activities.length).toBeLessThanOrEqual(MAX_ACTIVITIES);
      expect(new Set(activities.map((a) => a.skill.track))).toEqual(
        new Set(['portuguese', 'math']),
      );
      expect(activities.reduce((sum, a) => sum + a.length, 0)).toBeLessThanOrEqual(18);
      expect(new Set(activities.map((a) => a.skill.id)).size).toBe(activities.length);
    }
  });

  it('gives a first-day child only what needs nothing before it, shown first', () => {
    const activities = plan(() => 'new');
    expect(activities).toHaveLength(3);
    for (const { skill, isNew } of activities) {
      expect(skill.requires).toEqual([]);
      expect(isNew).toBe(true);
    }
  });

  it('never lets the same way of playing come twice in a row', () => {
    for (const profile of profiles()) {
      const kinds = plan(profile).map((a) => a.skill.interaction);
      // Only when both ways can be offered: a late child may have one left.
      if (new Set(kinds).size < 2) continue;
      kinds.slice(1).forEach((kind, index) => {
        expect(kind).not.toBe(kinds[index]);
      });
    }
  });

  it('never offers a skill that is still locked', () => {
    for (const profile of profiles()) {
      const isKnown = (id: string) => {
        const required = curriculum.find((s) => s.id === id);
        return required !== undefined && ['mastered', 'review'].includes(profile(required));
      };
      for (const { skill } of plan(profile)) {
        if (!isKnown(skill.id)) expect(skill.requires.every(isKnown), skill.id).toBe(true);
      }
    }
  });

  it('warms up with something known and brings back what is due', () => {
    const activities = plan((skill) => (skill.id === 'math.pay.3' ? 'review' : 'new'));
    expect(activities[0]).toMatchObject({ role: 'warm-up', skill: { id: 'math.pay.3' } });
    expect(activities[0]?.isNew).toBe(false);
  });

  it('respects what an adult hid and pinned', () => {
    const activities = plan(() => 'new', {
      'math.count.5': 'hide',
      'pt.letter.first': 'hide',
      'pt.letter.find': 'hide',
      'pt.letter.first.more': 'pin',
    });
    const ids = activities.map((a) => a.skill.id);
    expect(ids).not.toContain('math.count.5');
    expect(ids).toContain('pt.letter.first.more');
  });

  it('is the same for the same progress', () => {
    expect(plan(() => 'new')).toEqual(plan(() => 'new'));
  });
});

describe('curriculum content', () => {
  it('has unique ids and requirements that exist, with no way to get stuck', () => {
    const ids = curriculum.map((skill) => skill.id);
    expect(new Set(ids).size).toBe(ids.length);
    const reached = new Set<string>();
    ids.forEach(() => {
      for (const skill of curriculum) {
        if (skill.requires.every((id) => reached.has(id))) reached.add(skill.id);
      }
    });
    expect(reached.size).toBe(ids.length);
  });

  it('declares the way of playing that its activity really uses', () => {
    const context = { random: Math.random, words: wordBank };
    for (const skill of curriculum) {
      expect(skill.activity(context).interaction.kind, skill.id).toBe(skill.interaction);
    }
  });

  it('spells every word in syllables, with a picture and sounds', () => {
    for (const entry of wordBank) {
      expect(entry.syllables.join(''), entry.text).toBe(entry.text);
      expect(entry.sounds.length, entry.text).toBeGreaterThanOrEqual(entry.syllables.length);
      expect(entry.pictogram.length, entry.text).toBeGreaterThan(0);
    }
    expect(new Set(wordBank.map((entry) => entry.text)).size).toBe(wordBank.length);
  });
});
