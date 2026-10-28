import type { Clock } from '@application/ports/clock';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { Speech } from '@application/ports/speech';
import type { AttemptOutcome, MissionAttempt } from '@domain/mission/mission-attempt';
import type { Reward } from '@domain/reward/reward';
import { ok, type Result } from '@domain/shared/result';

export interface ChooseMissionAnswerResult {
  readonly attempt: MissionAttempt;
  readonly outcome: AttemptOutcome;
  /** Present only when this answer finished the mission. */
  readonly reward?: Reward;
}

/** Short, warm phrases. A wrong answer is never called "wrong". */
export const phrases = {
  correct: 'Isso!',
  completed: 'Você conseguiu! Muito bem!',
  hint: 'Vamos tentar de novo.',
} as const;

export class ChooseMissionAnswer {
  constructor(
    private readonly progress: ProgressRepository,
    private readonly speech: Speech,
    private readonly clock: Clock,
  ) {}

  async execute(
    current: MissionAttempt,
    choiceId: string,
  ): Promise<Result<ChooseMissionAnswerResult>> {
    const result = current.choose(choiceId);
    if (!result.ok) return result;

    const { attempt, outcome } = result.value;
    switch (outcome.kind) {
      case 'correct':
        void this.speech.speak(`${phrases.correct} ${outcome.nextStep.prompt}`);
        return ok({ attempt, outcome });
      case 'hint':
        void this.speech.speak(`${phrases.hint} ${outcome.step.prompt}`);
        return ok({ attempt, outcome });
      case 'completed': {
        const saved = await this.progress.load();
        const { progress, reward } = saved.completeMission(attempt.mission, {
          mistakes: attempt.mistakes,
          at: this.clock.now(),
        });
        await this.progress.save(progress);
        const { farewell } = attempt.mission;
        void this.speech.speak(
          farewell === undefined ? phrases.completed : `${farewell} ${phrases.completed}`,
        );
        return ok({ attempt, outcome, reward });
      }
    }
  }
}
