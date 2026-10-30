import type { Mission, MissionStep } from '@domain/mission/mission';
import { domainError, err, ok, type Result } from '@domain/shared/result';

export type AttemptOutcome =
  | { readonly kind: 'correct'; readonly nextStep: MissionStep }
  /** Not this one: the game shows the right card, and only that one can be pressed. */
  | { readonly kind: 'model'; readonly step: MissionStep }
  | { readonly kind: 'completed' };

interface State {
  readonly plan: readonly MissionStep[];
  readonly stepIndex: number;
  readonly modeling: boolean;
  readonly mistakes: number;
  readonly chosen: readonly string[];
  readonly repeated: readonly MissionStep[];
}

const accepts = (step: MissionStep, choiceId: string): boolean =>
  choiceId === step.targetId || step.accepts?.includes(choiceId) === true;

/**
 * Immutable state of a mission being played, following the fixed structure
 * request → action → celebration. A mistake shows the answer at once, so the
 * child never guesses through the cards. In a quiz, that question comes back
 * at the end to be answered alone.
 */
export class MissionAttempt {
  private constructor(
    readonly mission: Mission,
    private readonly state: State,
  ) {}

  static start(mission: Mission): MissionAttempt {
    return new MissionAttempt(mission, {
      plan: mission.steps,
      stepIndex: 0,
      modeling: false,
      mistakes: 0,
      chosen: [],
      repeated: [],
    });
  }

  get stepIndex(): number {
    return this.state.stepIndex;
  }

  get mistakes(): number {
    return this.state.mistakes;
  }

  get isModeling(): boolean {
    return this.state.modeling;
  }

  get isCompleted(): boolean {
    return this.state.stepIndex >= this.state.plan.length;
  }

  get currentStep(): MissionStep | undefined {
    return this.state.plan[this.state.stepIndex];
  }

  /** What the child chose, step by step (their own sentence, in AAC missions). */
  get chosen(): readonly string[] {
    return this.state.chosen;
  }

  choose(choiceId: string): Result<{ attempt: MissionAttempt; outcome: AttemptOutcome }> {
    const step = this.currentStep;
    if (step === undefined) {
      return err(domainError('mission-already-finished', 'The mission is already completed'));
    }

    if (!accepts(step, choiceId)) {
      const attempt = this.with({
        modeling: true,
        mistakes: this.state.mistakes + (this.state.modeling ? 0 : 1),
      });
      return ok({ attempt, outcome: { kind: 'model', step } });
    }

    const repeat =
      this.state.modeling && this.mission.kind === 'quiz' && !this.state.repeated.includes(step);
    const attempt = this.with({
      plan: repeat ? [...this.state.plan, step] : this.state.plan,
      repeated: repeat ? [...this.state.repeated, step] : this.state.repeated,
      stepIndex: this.state.stepIndex + 1,
      modeling: false,
      chosen: [...this.state.chosen, choiceId],
    });
    const nextStep = attempt.currentStep;
    return ok({
      attempt,
      outcome: nextStep === undefined ? { kind: 'completed' } : { kind: 'correct', nextStep },
    });
  }

  private with(changes: Partial<State>): MissionAttempt {
    return new MissionAttempt(this.mission, { ...this.state, ...changes });
  }
}
