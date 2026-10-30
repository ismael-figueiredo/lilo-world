import { describe, expect, it } from 'vitest';
import {
  answerOf,
  writtenOf,
  type ActivityContext,
  type ActivityItem,
} from '@domain/activity/activity';
import { ActivityRound, ROUND_LENGTH } from '@domain/activity/activity-round';
import { MAX_LEVEL, skillsAt, stations, type Station } from '@domain/curriculum/skill';
import { firstLetter, word, type Word } from '@domain/language/word';
import { seededRandom } from '@domain/shared/random';
import { wordBank } from '@infrastructure/catalog/curriculum/word-bank';
import { curriculum } from '@infrastructure/catalog/static-content-catalog';

const context = (seed: number, words: readonly Word[] = wordBank): ActivityContext => ({
  random: seededRandom(seed),
  words,
});

const few: readonly Word[] = [
  word('BO-LA', 'b-o-l-a', '⚽'),
  word('GA-TO', 'g-a-t-o', '🐱'),
  word('PA-TO', 'p-a-t-o', '🦆'),
  word('U-VA', 'u-v-a', '🍇'),
];

const skillNamed = (id: string) => {
  const found = curriculum.find((skill) => skill.id === id);
  if (found === undefined) throw new Error(`No skill ${id}`);
  return found;
};

const item = (id: string, ctx: ActivityContext = context(1)): ActivityItem => ({
  ...skillNamed(id).activity(ctx),
  skillId: id,
});

const wrongAnswer = (activity: ActivityItem): string => {
  const { interaction } = activity;
  return interaction.kind === 'tap'
    ? (interaction.options.find((o) => o.id !== interaction.answerId)?.id ?? '')
    : String(interaction.goal === 1 ? 2 : 1);
};

/** Words on screen, as written: "A" is a letter, the "a" of a sentence is not. */
const tokens = (text: string): readonly string[] => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

describe('nothing on screen gives the answer', () => {
  const answers = wordBank.map((w) => w.text.toLowerCase());

  it('never writes an answer shown among the options', () => {
    const ctx = context(2);
    for (const skill of curriculum) {
      for (let i = 0; i < 80; i += 1) {
        const { prompt, interaction } = item(skill.id, ctx);
        if (interaction.kind !== 'tap') continue;
        const right = interaction.options.find((o) => o.id === interaction.answerId);
        expect(tokens(writtenOf(prompt, true)), skill.id).not.toContain(right?.text);
      }
    }
  });

  it('never writes the word a picture stands for', () => {
    const ctx = context(3);
    for (const skill of curriculum) {
      for (let i = 0; i < 80; i += 1) {
        const { prompt, stimulus } = item(skill.id, ctx);
        if (stimulus.kind !== 'picture') continue;
        for (const shown of [prompt.written, writtenOf(prompt, false)]) {
          const written = tokens(shown ?? '').map((t) => t.toLowerCase());
          expect(
            written.filter((t) => answers.includes(t)),
            skill.id,
          ).toEqual([]);
        }
      }
    }
  });

  it('says the word out loud, and only the voice says it', () => {
    const { prompt, stimulus } = item('pt.letter.first');
    expect(stimulus.kind).toBe('picture');
    expect(prompt.text).toMatch(/^Com qual letra começa \S+\?$/);
    expect(prompt.written).toBe('Com qual letra começa?');
  });

  it('writes the question in full when the voice is off and only it could ask', () => {
    const { prompt } = item('pt.letter.find');
    expect(writtenOf(prompt, true)).toBe('Onde está a letra?');
    expect(writtenOf(prompt, false)).toBe(prompt.text);
  });
});

describe('questions in small steps', () => {
  const answersOf = (id: string, seed: number): number[] => {
    const skill = skillNamed(id);
    const ctx = context(seed);
    let round = ActivityRound.start({ station: skill.station, level: 1, skills: [skill] }, ctx);
    const answers = [Number(answerOf(round.item.interaction))];
    for (let i = 1; i < ROUND_LENGTH; i += 1) {
      round = round.answer(answerOf(round.item.interaction), ctx).round;
      answers.push(Number(answerOf(round.item.interaction)));
    }
    return answers;
  };

  it.each(['math.carry.5', 'math.count.5'])('%s starts small and may reach the top', (id) => {
    for (let seed = 1; seed < 40; seed += 1) {
      const [first = 0] = answersOf(id, seed);
      expect(first).toBeLessThanOrEqual(3);
    }
    const lasts = Array.from({ length: 40 }, (_, seed) => answersOf(id, seed).at(-1));
    expect(lasts).toContain(5);
  });

  it('never jumps by more than 3 from a question to the next one', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const answers = answersOf('math.carry.5', seed);
      answers.slice(1).forEach((answer, index) => {
        expect(Math.abs(answer - (answers[index] ?? 0))).toBeLessThanOrEqual(3);
      });
    }
  });

  it('never asks for the same answer twice in a row', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const answers = answersOf('math.count.5', seed);
      answers.slice(1).forEach((answer, index) => {
        expect(answer).not.toBe(answers[index]);
      });
    }
  });
});

describe('activities', () => {
  it('always has exactly one right answer among distinct options', () => {
    const ctx = context(1);
    for (const skill of curriculum) {
      for (let i = 0; i < 60; i += 1) {
        const { interaction } = item(skill.id, ctx);
        if (interaction.kind === 'tap') {
          const ids = interaction.options.map((o) => o.id);
          expect(new Set(ids).size, skill.id).toBe(ids.length);
          expect(ids.filter((id) => id === interaction.answerId)).toHaveLength(1);
          expect(ids.length).toBeGreaterThanOrEqual(3);
        } else {
          // More pieces than needed: the child has to count, not just move them all.
          expect(interaction.supply, skill.id).toBeGreaterThan(interaction.goal);
        }
      }
    }
  });

  it('is the same for the same seed', () => {
    expect(item('math.count.10', context(9))).toEqual(item('math.count.10', context(9)));
  });

  it('asks for the first letter of a word with only its picture', () => {
    const activity = item('pt.letter.first', context(3, few));
    expect(activity.stimulus.kind).toBe('picture');
    const shown = activity.stimulus.kind === 'picture' ? activity.stimulus.picture.pictogram : '';
    const asked = few.find((w) => w.pictogram === shown);
    expect(answerOf(activity.interaction)).toBe(firstLetter(asked?.text ?? ''));
    expect(activity.letter).toBe(answerOf(activity.interaction));
    expect(item('pt.letter.first.more', context(3, few)).interaction).toMatchObject({
      options: { length: 4 },
    });
  });

  it('uses the letter without accent marks', () => {
    const accented = [word('ÁR-VO-RE', 'a-r-v-o-r-e', '🌳')];
    const activity = item('pt.letter.first.more', context(2, accented));
    expect(answerOf(activity.interaction)).toBe('A');
    expect(firstLetter('ÔNIBUS')).toBe('O');
  });

  it('can fill the whole alphabet album', () => {
    const ctx = context(4);
    const letters = new Set<string>();
    for (let i = 0; i < 1000; i += 1) letters.add(item('pt.letter.find', ctx).letter ?? '');
    expect(letters.size).toBe(26);
  });

  it('matches a word to its picture at the top letter level', () => {
    const activity = item('pt.word.read', context(4, few));
    const shown = activity.stimulus.kind === 'word' ? activity.stimulus.text : '';
    expect(answerOf(activity.interaction)).toBe(shown);
  });

  it('counts what is shown, in easy groups, up to the limit of the skill', () => {
    const ctx = context(5);
    for (let i = 0; i < 40; i += 1) {
      const activity = item('math.count.10', ctx);
      const groups = activity.stimulus.kind === 'objects' ? activity.stimulus.groups : [];
      const total = groups.reduce((sum, group) => sum + group, 0);
      expect(total).toBe(Number(answerOf(activity.interaction)));
      expect(total).toBeLessThanOrEqual(10);
      expect(groups.every((group) => group <= 5)).toBe(true);
    }
  });

  it('adds what the two groups show', () => {
    const activity = item('math.add.10', context(7));
    const { a = 0, b = 0 } = activity.stimulus.kind === 'sum' ? activity.stimulus : {};
    expect(Number(answerOf(activity.interaction))).toBe(a + b);
  });

  it('pays the price by carrying coins', () => {
    const activity = item('math.pay.3', context(6));
    const price = activity.stimulus.kind === 'price' ? activity.stimulus.price : 0;
    expect(activity.interaction).toMatchObject({ kind: 'drag', goal: price });
  });
});

describe('activity round', () => {
  const ctx = context(11);
  const start = (station: Station, level: number, extra: object = {}) =>
    ActivityRound.start(
      { station, level, skills: skillsAt(curriculum, station, level), ...extra },
      ctx,
    );
  const right = (round: ActivityRound) => round.answer(answerOf(round.item.interaction), ctx);
  const wrong = (round: ActivityRound) => round.answer(wrongAnswer(round.item), ctx);
  const play = (first: ActivityRound, turns: number) => {
    let round = first;
    let last = right(round);
    for (let i = 1; i < turns; i += 1) {
      round = last.round;
      last = right(round);
    }
    return last;
  };

  it('always ends after five questions, going up a level when it went well', () => {
    const last = play(start('numbers', 1), ROUND_LENGTH);
    expect(last.outcome).toMatchObject({
      kind: 'correct',
      summary: { score: 5, total: 5, reachedLevel: 2 },
    });
  });

  it('mixes the skills of a level in one round', () => {
    let round = start('numbers', 1);
    const seen = new Set([round.item.skillId]);
    for (let i = 0; i < 4; i += 1) {
      round = right(round).round;
      seen.add(round.item.skillId);
    }
    expect(seen).toEqual(new Set(['math.count.5', 'math.carry.5']));
  });

  it('after a mistake shows the answer, moves to a new question, and scores no point', () => {
    const first = start('numbers', 2);
    const missed = wrong(first);
    expect(missed.outcome).toEqual({ kind: 'model', answerId: answerOf(first.item.interaction) });
    expect(missed.round.item).toBe(first.item);

    const shown = right(missed.round);
    expect(shown.outcome.kind).toBe('practiced');
    expect(shown.round.score).toBe(0);
    expect(shown.round.item).not.toBe(first.item);
  });

  it('brings the missed question back later, without points', () => {
    const first = start('numbers', 2);
    let round = right(wrong(first).round).round;
    round = right(round).round;
    round = right(round).round;
    expect(round.isRetry).toBe(true);
    expect(round.item.stimulus).toEqual(first.item.stimulus);
    expect(right(round).outcome.kind).toBe('practiced');
  });

  it('cannot go up a level by guessing', () => {
    let round = start('numbers', 1);
    let summary;
    for (let i = 0; i < 20 && summary === undefined; i += 1) {
      const step = right(wrong(round).round);
      round = step.round;
      if (step.outcome.kind !== 'model') summary = step.outcome.summary;
    }
    expect(summary?.score).toBe(0);
    expect(summary?.reachedLevel).toBeUndefined();
  });

  it('ends gently when it is hard today, without a level or a score to show', () => {
    let round = start('numbers', 1, { maxMistakes: 2 });
    round = right(wrong(round).round).round;
    const last = right(wrong(round).round);
    expect(last.outcome).toMatchObject({ summary: { shortened: true } });
    expect(last.outcome.kind === 'practiced' && last.outcome.summary?.reachedLevel).toBeUndefined();
  });

  it('a demonstration is no mistake and does not bring the question back', () => {
    const first = start('numbers', 1).demonstrate();
    expect(first.isDemonstration).toBe(true);
    const shown = right(first);
    expect(shown.outcome.kind).toBe('practiced');
    expect(shown.round.mistakes).toBe(0);
    expect(shown.round.isRetry).toBe(false);
    expect(right(right(shown.round).round).round.isRetry).toBe(false);
  });

  it('never goes down a level and stays at the top', () => {
    const last = play(start('letters', MAX_LEVEL), ROUND_LENGTH);
    expect(last.outcome).toMatchObject({ summary: { score: 5 } });
    expect(last.outcome.kind === 'correct' && last.outcome.summary?.reachedLevel).toBeUndefined();
    expect(last.round.level).toBe(MAX_LEVEL);
  });

  it('avoids repeating a recent question', () => {
    let round = start('coins', 3);
    const seen = [JSON.stringify(round.item.stimulus) + round.item.prompt.text];
    for (let i = 1; i < ROUND_LENGTH; i += 1) {
      round = right(round).round;
      const key = JSON.stringify(round.item.stimulus) + round.item.prompt.text;
      expect(seen).not.toContain(key);
      seen.push(key);
    }
  });

  it('reports the letter learned', () => {
    const round = start('letters', 1);
    expect(right(round).outcome).toMatchObject({ kind: 'correct', letter: round.item.letter });
  });

  it('clamps levels from old or broken saves', () => {
    const skills = skillsAt(curriculum, 'numbers', 1);
    expect(ActivityRound.start({ station: 'numbers', level: 0, skills }, ctx).level).toBe(1);
    expect(ActivityRound.start({ station: 'numbers', level: 99, skills }, ctx).level).toBe(
      MAX_LEVEL,
    );
  });

  it('has skills at every level of every station', () => {
    for (const station of stations) {
      for (let level = 1; level <= MAX_LEVEL; level += 1) {
        expect(skillsAt(curriculum, station, level).length, station).toBeGreaterThan(0);
      }
    }
  });
});
