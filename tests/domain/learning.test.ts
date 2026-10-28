import { describe, expect, it } from 'vitest';
import {
  createChallenge,
  firstLetter,
  MAX_LEVEL,
  skills,
  type Word,
} from '@domain/learning/challenge';
import { ChallengeSession, STREAK_TO_LEVEL_UP } from '@domain/learning/challenge-session';
import { seededRandom } from '@domain/shared/random';
import { words } from '@infrastructure/catalog/words';

/** Pictures on screen, counted as the child sees them (one emoji = one). */
const pictures = (text: string): number => [...new Intl.Segmenter().segment(text)].length;

const few: readonly Word[] = [
  { text: 'BOLA', pictogram: '⚽' },
  { text: 'GATO', pictogram: '🐱' },
  { text: 'PATO', pictogram: '🦆' },
  { text: 'UVA', pictogram: '🍇' },
];

describe('challenges', () => {
  it('always has exactly one right card among distinct options', () => {
    const random = seededRandom(1);
    for (const skill of skills) {
      for (let level = 1; level <= MAX_LEVEL; level += 1) {
        for (let i = 0; i < 60; i += 1) {
          const challenge = createChallenge(skill, level, random, words);
          const ids = challenge.options.map((o) => o.id);
          expect(new Set(ids).size, `${skill} ${level}`).toBe(ids.length);
          expect(ids.filter((id) => id === challenge.answerId)).toHaveLength(1);
          expect(ids.length).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('is the same for the same seed', () => {
    const a = createChallenge('numbers', 2, seededRandom(9), words);
    const b = createChallenge('numbers', 2, seededRandom(9), words);
    expect(a).toEqual(b);
  });

  it('asks for the first letter of a word with its picture', () => {
    const challenge = createChallenge('letters', 1, seededRandom(3), few);
    const word = few.find((w) => challenge.show.includes(w.text));
    expect(word).toBeDefined();
    expect(challenge.answerId).toBe(firstLetter(word?.text ?? ''));
    expect(challenge.letter).toBe(challenge.answerId);
    expect(challenge.options).toHaveLength(3);
    expect(createChallenge('letters', 2, seededRandom(3), few).options).toHaveLength(4);
  });

  it('uses the letter without accent marks', () => {
    const accented: readonly Word[] = [{ text: 'ÁRVORE', pictogram: '🌳' }];
    const challenge = createChallenge('letters', 2, seededRandom(2), accented);
    expect(challenge.answerId).toBe('A');
    expect(challenge.options.map((o) => o.id)).not.toContain('Á');
    expect(firstLetter('ÔNIBUS')).toBe('O');
  });

  it('matches a word to its picture at the top letter level', () => {
    const challenge = createChallenge('letters', 3, seededRandom(4), few);
    const answer = challenge.options.find((o) => o.id === challenge.answerId);
    expect(few.find((w) => w.text === challenge.show)?.pictogram).toBe(answer?.face);
  });

  it('counts what is shown, up to 5 and then up to 10, and adds at level 3', () => {
    const random = seededRandom(5);
    for (let i = 0; i < 40; i += 1) {
      const easy = createChallenge('numbers', 1, random, words);
      expect(pictures(easy.show)).toBe(Number(easy.answerId));
      expect(Number(easy.answerId)).toBeLessThanOrEqual(5);
      const sum = createChallenge('numbers', 3, random, words);
      const [a, b] = /(\d+) mais (\d+)/.exec(sum.question)?.slice(1).map(Number) ?? [];
      expect(Number(sum.answerId)).toBe((a ?? 0) + (b ?? 0));
    }
  });

  it('pays the price with the same number of coins', () => {
    const challenge = createChallenge('coins', 1, seededRandom(6), words);
    const answer = challenge.options.find((o) => o.id === challenge.answerId);
    expect(pictures(answer?.face ?? '')).toBe(Number(challenge.answerId));
    expect(challenge.show).toContain(`${challenge.answerId} 🪙`);
  });
});

describe('challenge session', () => {
  const random = seededRandom(11);
  const right = (session: ChallengeSession) =>
    session.answer(session.challenge.answerId, random, few);
  const wrong = (session: ChallengeSession) => {
    const id = session.challenge.options.find((o) => o.id !== session.challenge.answerId)?.id ?? '';
    return session.answer(id, random, few);
  };

  it('goes up a level after a streak of right answers', () => {
    let session = ChallengeSession.start('numbers', 1, random, few);
    for (let i = 0; i < STREAK_TO_LEVEL_UP - 1; i += 1) {
      const step = right(session);
      expect(step.outcome).toEqual({ kind: 'correct' });
      session = step.session;
    }
    const last = right(session);
    expect(last.outcome).toEqual({ kind: 'correct', reachedLevel: 2 });
    expect(last.session.level).toBe(2);
    expect(last.session.streak).toBe(0);
  });

  it('never goes down: a mistake keeps the level, starts the streak again and gives hints', () => {
    let session = ChallengeSession.start('coins', 2, random, few);
    session = right(session).session;
    const first = wrong(session);
    expect(first.outcome).toEqual({ kind: 'hint', hintLevel: 1 });
    expect(first.session.level).toBe(2);
    expect(first.session.streak).toBe(0);
    expect(first.session.challenge).toBe(session.challenge);
    const second = wrong(first.session);
    const third = wrong(second.session);
    expect(third.outcome).toEqual({ kind: 'hint', hintLevel: 2 });
    expect(third.session.mistakes).toBe(3);
    expect(right(third.session).session.hintLevel).toBe(0);
  });

  it('keeps practicing at the top level', () => {
    let session = ChallengeSession.start('letters', MAX_LEVEL, random, few);
    expect(session.isAtTop).toBe(true);
    for (let i = 0; i < STREAK_TO_LEVEL_UP + 1; i += 1) {
      const step = right(session);
      expect(step.outcome.kind).toBe('correct');
      expect(step.outcome.kind === 'correct' && step.outcome.reachedLevel).toBeFalsy();
      session = step.session;
    }
    expect(session.level).toBe(MAX_LEVEL);
  });

  it('reports the letter learned', () => {
    const session = ChallengeSession.start('letters', 1, random, few);
    const step = right(session);
    expect(step.outcome).toMatchObject({ kind: 'correct', letter: session.challenge.letter });
  });

  it('clamps levels from old or broken saves', () => {
    expect(ChallengeSession.start('numbers', 0, random, few).level).toBe(1);
    expect(ChallengeSession.start('numbers', 99, random, few).level).toBe(MAX_LEVEL);
  });
});
