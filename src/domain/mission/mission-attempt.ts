import type { Mission, MissionStep } from '@domain/mission/mission';
import { domainError, err, ok, type Result } from '@domain/shared/result';

/** Each wrong answer makes the hint clearer, up to this level. Errors never punish. */
export const MAX_HINT_LEVEL = 2;

export type HintLevel = 0 | 1 | 2;

export type AttemptOutcome =
  | { readonly kind: 'correct'; readonly nextStep: MissionStep }
  | { readonly kind: 'hint'; readonly hintLevel: HintLevel; readonly step: MissionStep }
  | { readonly kind: 'completed' };

/**
 * Immutable state of a mission being played, following the fixed structure
 * request → action → celebration.
 */
export class MissionAttempt {
  private constructor(
    readonly mission: Mission,
    readonly stepIndex: number,
    readonly hintLevel: HintLevel,
    readonly mistakes: number,
  ) {}

  static start(mission: Mission): MissionAttempt {
    return new MissionAttempt(mission, 0, 0, 0);
  }

  get isCompleted(): boolean {
    return this.stepIndex >= this.mission.steps.length;
  }

  get currentStep(): MissionStep | undefined {
    return this.mission.steps[this.stepIndex];
  }

  /** Ids of choices already collected in earlier steps. */
  get completedTargets(): readonly string[] {
    return this.mission.steps.slice(0, this.stepIndex).map((step) => step.targetId);
  }

  choose(choiceId: string): Result<{ attempt: MissionAttempt; outcome: AttemptOutcome }> {
    const step = this.currentStep;
    if (step === undefined) {
      return err(domainError('mission-already-finished', 'The mission is already completed'));
    }

    if (choiceId !== step.targetId) {
      const hintLevel = Math.min(this.hintLevel + 1, MAX_HINT_LEVEL) as HintLevel;
      const attempt = new MissionAttempt(
        this.mission,
        this.stepIndex,
        hintLevel,
        this.mistakes + 1,
      );
      return ok({ attempt, outcome: { kind: 'hint', hintLevel, step } });
    }

    const attempt = new MissionAttempt(this.mission, this.stepIndex + 1, 0, this.mistakes);
    const nextStep = attempt.currentStep;
    return ok({
      attempt,
      outcome: nextStep === undefined ? { kind: 'completed' } : { kind: 'correct', nextStep },
    });
  }
}
