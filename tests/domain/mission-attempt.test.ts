import { describe, expect, it } from 'vitest';
import { MissionAttempt } from '@domain/mission/mission-attempt';
import { mission } from '../support/fixtures';

const choose = (attempt: MissionAttempt, choiceId: string) => {
  const result = attempt.choose(choiceId);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe('MissionAttempt', () => {
  it('starts on the first step with no hint', () => {
    const attempt = MissionAttempt.start(mission);
    expect(attempt.currentStep?.targetId).toBe('apple');
    expect(attempt.isModeling).toBe(false);
    expect(attempt.isCompleted).toBe(false);
  });

  it('moves to the next step on a correct choice', () => {
    const { attempt, outcome } = choose(MissionAttempt.start(mission), 'apple');
    expect(outcome).toEqual({ kind: 'correct', nextStep: mission.steps[1] });
    expect(attempt.chosen).toEqual(['apple']);
  });

  it('shows the answer on a mistake and stays on the step until it is pressed', () => {
    const { attempt, outcome } = choose(MissionAttempt.start(mission), 'bread');
    expect(outcome).toEqual({ kind: 'model', step: mission.steps[0] });
    expect(attempt.isModeling).toBe(true);
    expect(attempt.currentStep?.targetId).toBe('apple');
    const again = choose(attempt, 'bread').attempt;
    expect(again.mistakes).toBe(1);
    expect(choose(again, 'apple').attempt.isModeling).toBe(false);
  });

  it('brings a missed quiz question back at the end, once', () => {
    const quiz = { ...mission, kind: 'quiz' as const };
    let attempt = choose(MissionAttempt.start(quiz), 'bread').attempt;
    attempt = choose(attempt, 'apple').attempt;
    attempt = choose(attempt, 'milk').attempt;
    expect(attempt.currentStep?.targetId).toBe('apple');
    const { attempt: done, outcome } = choose(attempt, 'apple');
    expect(outcome).toEqual({ kind: 'completed' });
    expect(done.isCompleted).toBe(true);
  });

  it('does not repeat steps of other kinds of mission', () => {
    let attempt = choose(MissionAttempt.start(mission), 'bread').attempt;
    attempt = choose(attempt, 'apple').attempt;
    expect(choose(attempt, 'milk').outcome).toEqual({ kind: 'completed' });
  });

  it('accepts any of the free choices and remembers them', () => {
    const step = { targetId: 'apple', accepts: ['milk'], prompt: 'O que você quer?' };
    const free = { ...mission, steps: [step] };
    const { attempt, outcome } = choose(MissionAttempt.start(free), 'milk');
    expect(outcome).toEqual({ kind: 'completed' });
    expect(attempt.chosen).toEqual(['milk']);
  });

  it('completes after the last step', () => {
    const first = choose(MissionAttempt.start(mission), 'apple').attempt;
    const { attempt, outcome } = choose(first, 'milk');
    expect(outcome).toEqual({ kind: 'completed' });
    expect(attempt.isCompleted).toBe(true);
    expect(attempt.currentStep).toBeUndefined();
  });

  it('refuses choices after completion', () => {
    const first = choose(MissionAttempt.start(mission), 'apple').attempt;
    const done = choose(first, 'milk').attempt;
    const result = done.choose('apple');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('mission-already-finished');
  });
});
