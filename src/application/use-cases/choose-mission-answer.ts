import type { Clock } from '@application/ports/clock';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { Speech } from '@application/ports/speech';
import type { MissionStep } from '@domain/mission/mission';
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
  model: 'Olhe, é esta:',
  modelOption: 'Olhe, esta serve:',
} as const;

/** What is said when the answer is shown. In the street, it is the instruction again. */
export function modelSentence(attempt: MissionAttempt, step: MissionStep): string {
  if (attempt.mission.kind === 'world-task') return step.prompt;
  const answer = attempt.mission.choices.find((choice) => choice.id === step.targetId);
  // With several right answers the card shown is one that works, not the only one.
  const intro =
    step.accepts === undefined || step.accepts.length === 0 ? phrases.model : phrases.modelOption;
  return `${intro} ${answer?.label ?? ''}.`;
}

/** After a right card: praise and the next instruction. A sentence card says its word. */
export function stepSentence(attempt: MissionAttempt, choiceId: string, next: MissionStep): string {
  if (attempt.mission.kind !== 'build-sentence') return `${phrases.correct} ${next.prompt}`;
  const card = attempt.mission.choices.find((choice) => choice.id === choiceId);
  return `${card?.label ?? ''}. ${next.prompt}`;
}

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
        void this.speech.speak(stepSentence(attempt, choiceId, outcome.nextStep));
        return ok({ attempt, outcome });
      case 'model':
        void this.speech.speak(modelSentence(attempt, outcome.step));
        return ok({ attempt, outcome });
      case 'completed': {
        const silent = attempt.mission.kind === 'build-sentence';
        const saved = await this.progress.load();
        const { progress, reward } = saved.completeMission(attempt.mission, {
          mistakes: attempt.mistakes,
          at: this.clock.now(),
        });
        await this.progress.save(progress);
        const { farewell } = attempt.mission;
        // A sentence is spoken only when the child presses "Falar".
        if (!silent) {
          void this.speech.speak(
            farewell === undefined ? phrases.completed : `${farewell} ${phrases.completed}`,
          );
        }
        return ok({ attempt, outcome, reward });
      }
    }
  }
}
