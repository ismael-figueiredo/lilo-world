import { describe, expect, it } from 'vitest';
import { MAX_HINT_LEVEL, MissionAttempt } from '@domain/mission/mission-attempt';
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
    expect(attempt.hintLevel).toBe(0);
    expect(attempt.isCompleted).toBe(false);
  });

  it('moves to the next step on a correct choice', () => {
    const { attempt, outcome } = choose(MissionAttempt.start(mission), 'apple');
    expect(outcome).toEqual({ kind: 'correct', nextStep: mission.steps[1] });
    expect(attempt.completedTargets).toEqual(['apple']);
  });

  it('gives a clearer hint on each mistake, never more than the maximum', () => {
    let attempt = MissionAttempt.start(mission);
    const levels: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const result = choose(attempt, 'bread');
      attempt = result.attempt;
      if (result.outcome.kind === 'hint') levels.push(result.outcome.hintLevel);
    }
    expect(levels).toEqual([1, 2, MAX_HINT_LEVEL, MAX_HINT_LEVEL]);
    expect(attempt.mistakes).toBe(4);
    expect(attempt.currentStep?.targetId).toBe('apple');
  });

  it('resets the hint after a correct choice', () => {
    const afterMistake = choose(MissionAttempt.start(mission), 'bread').attempt;
    const { attempt } = choose(afterMistake, 'apple');
    expect(attempt.hintLevel).toBe(0);
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
