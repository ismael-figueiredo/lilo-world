import { describe, expect, it } from 'vitest';
import {
  createChallenge,
  firstLetter,
  MAX_LEVEL,
  skills,
  type Word,
} from '@domain/learning/challenge';
import { ChallengeSession, ROUND_LENGTH } from '@domain/learning/challenge-session';
import { seededRandom } from '@domain/shared/random';
import { words } from '@infrastructure/catalog/words';

/** Pictures on screen, counted as the child sees them (one emoji = one). */
const pictures = (text: string): number =>
  [...new Intl.Segmenter().segment(text.replaceAll(' ', ''))].length;

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
    // Only the picture is shown: the written word would give the answer.
    const word = few.find((w) => challenge.show === w.pictogram);
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

describe('challenge round', () => {
  const random = seededRandom(11);
  const right = (session: ChallengeSession) =>
    session.answer(session.challenge.answerId, random, words);
  const wrong = (session: ChallengeSession) => {
    const id = session.challenge.options.find((o) => o.id !== session.challenge.answerId)?.id ?? '';
    return session.answer(id, random, words);
  };
  const play = (start: ChallengeSession, turns: number) => {
    let session = start;
    let last = right(session);
    for (let i = 1; i < turns; i += 1) {
      session = last.session;
      last = right(session);
    }
    return last;
  };

  it('always ends after five questions, going up a level when it went well', () => {
    const last = play(ChallengeSession.start('numbers', 1, random, words), ROUND_LENGTH);
    expect(last.outcome).toMatchObject({
      kind: 'correct',
      summary: { score: 5, total: 5, reachedLevel: 2 },
    });
  });

  it('after a mistake shows the answer, moves to a new question, and scores no point', () => {
    const start = ChallengeSession.start('numbers', 2, random, words);
    const missed = wrong(start);
    expect(missed.outcome).toEqual({ kind: 'model', answerId: start.challenge.answerId });
    expect(missed.session.challenge).toBe(start.challenge);

    const shown = right(missed.session);
    expect(shown.outcome.kind).toBe('practiced');
    expect(shown.session.score).toBe(0);
    expect(shown.session.challenge).not.toBe(start.challenge);
  });

  it('brings the missed question back later, without points', () => {
    const start = ChallengeSession.start('numbers', 2, random, words);
    let session = right(wrong(start).session).session;
    session = right(session).session;
    session = right(session).session;
    expect(session.isRetry).toBe(true);
    expect(session.challenge.show).toBe(start.challenge.show);
    expect(new Set(session.challenge.options.map((o) => o.id))).toEqual(
      new Set(start.challenge.options.map((o) => o.id)),
    );
    expect(right(session).outcome.kind).toBe('practiced');
  });

  it('cannot go up a level by guessing', () => {
    let session = ChallengeSession.start('numbers', 1, random, words);
    let summary;
    for (let i = 0; i < 20 && summary === undefined; i += 1) {
      const step = right(wrong(session).session);
      session = step.session;
      if (step.outcome.kind !== 'model') summary = step.outcome.summary;
    }
    expect(summary?.score).toBe(0);
    expect(summary?.reachedLevel).toBeUndefined();
  });

  it('never goes down a level and stays at the top', () => {
    const top = ChallengeSession.start('letters', MAX_LEVEL, random, words);
    const last = play(top, ROUND_LENGTH);
    expect(last.outcome).toMatchObject({ summary: { score: 5 } });
    expect(last.outcome.kind === 'correct' && last.outcome.summary?.reachedLevel).toBeUndefined();
    expect(last.session.level).toBe(MAX_LEVEL);
  });

  it('avoids repeating a recent question', () => {
    const start = ChallengeSession.start('letters', 1, seededRandom(3), words);
    const seen = [start.challenge.show];
    let session = start;
    const rng = seededRandom(3);
    for (let i = 1; i < ROUND_LENGTH; i += 1) {
      session = session.answer(session.challenge.answerId, rng, words).session;
      expect(seen).not.toContain(session.challenge.show);
      seen.push(session.challenge.show);
    }
  });

  it('reports the letter learned', () => {
    const session = ChallengeSession.start('letters', 1, random, words);
    const step = right(session);
    expect(step.outcome).toMatchObject({ kind: 'correct', letter: session.challenge.letter });
  });

  it('clamps levels from old or broken saves', () => {
    expect(ChallengeSession.start('numbers', 0, random, words).level).toBe(1);
    expect(ChallengeSession.start('numbers', 99, random, words).level).toBe(MAX_LEVEL);
  });
});
