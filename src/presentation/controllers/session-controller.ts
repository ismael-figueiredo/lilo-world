import { phrases } from '@application/phrases';
import type { PlannedActivity } from '@domain/curriculum/session-plan';
import type { GameContext } from '@presentation/game-context';
import type { ActivityController } from '@presentation/controllers/activity-controller';
import { DayBoard, type DayStep } from '@presentation/ui/activity/day-path';
import { studyLooks } from '@presentation/ui/study-looks';
import { SESSION_COINS } from '@application/use-cases/plan-session';

interface Step {
  readonly activity: PlannedActivity;
  done: boolean;
}

/** The pause is offered in the middle of the day's plan, once. */
const PAUSE_AFTER = 2;

/**
 * The day's study: three short activities the child puts in order at the
 * desk, a pause in the middle and always the same ending.
 */
export class SessionController {
  readonly board: DayBoard;
  private steps: Step[] = [];
  private rewarded = false;
  private onDone: (() => void) | undefined;
  private onLater: (() => void) | undefined;

  constructor(
    private readonly ctx: GameContext,
    private readonly activities: ActivityController,
  ) {
    this.board = new DayBoard({
      onChoose: (index) => {
        this.choose(index);
      },
      onLater: () => {
        this.later();
      },
      onBreathEnd: () => {
        this.open();
      },
      onFinish: () => {
        this.leave();
      },
    });
  }

  /** Sitting at the desk: what today's study has. */
  async start(onDone: () => void, onLater: () => void): Promise<void> {
    this.onDone = onDone;
    this.onLater = onLater;
    const plan = await this.ctx.player.planSession.execute();
    this.steps = plan.map((activity) => ({ activity, done: false }));
    this.rewarded = false;
    this.open();
  }

  open(): void {
    if (this.steps.length === 0 || this.steps.every((step) => step.done)) {
      this.leave();
      return;
    }
    this.ctx.enterPanel('session');
    const finished = this.steps.filter((step) => step.done).length;
    this.board.show(this.view(), finished === PAUSE_AFTER - 1 || finished === PAUSE_AFTER);
    this.ctx.say(finished === 0 ? phrases.dayStart : phrases.dayNext);
  }

  /** Not now: the child gets up, and the desk keeps today's study for later. */
  later(): void {
    this.board.hide();
    this.ctx.backToExploring();
    this.onLater?.();
  }

  close(): void {
    this.board.hide();
  }

  private view(): DayStep[] {
    return this.steps.map(({ activity, done }) => {
      const look = studyLooks[activity.skill.station];
      return { icon: look.icon, name: activity.skill.name, color: look.color, done };
    });
  }

  private choose(index: number): void {
    const step = this.steps[index];
    if (step === undefined || step.done) return;
    this.board.hide();
    void this.activities.openPlanned(step.activity, (finished) => {
      this.ended(step, finished);
    });
  }

  private ended(step: Step, finished: boolean): void {
    step.done = step.done || finished;
    if (this.steps.every((s) => s.done) || this.ctx.restIsDue) {
      void this.finish();
      return;
    }
    this.open();
  }

  /** Always the same ending, whatever happened along the way. */
  private async finish(): Promise<void> {
    if (!this.rewarded) {
      this.rewarded = true;
      await this.ctx.player.planSession.finish();
      await this.ctx.refresh();
    }
    this.ctx.enterPanel('session');
    this.ctx.sound('star');
    this.board.showEnd(
      this.view().filter((step) => step.done),
      SESSION_COINS,
    );
    this.ctx.say(phrases.dayEnd);
  }

  private leave(): void {
    this.board.hide();
    this.ctx.backToExploring();
    this.onDone?.();
    this.onDone = undefined;
  }
}
