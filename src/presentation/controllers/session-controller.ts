import { phrases } from '@application/phrases';
import type { PlannedActivity } from '@domain/curriculum/session-plan';
import type { Station } from '@domain/curriculum/skill';
import type { GameContext } from '@presentation/game-context';
import type { ActivityController } from '@presentation/controllers/activity-controller';
import { DayBoard, type DayStep } from '@presentation/ui/activity/day-path';
import { stationId, stationLooks } from '@presentation/world/stations';
import { SESSION_COINS } from '@application/use-cases/plan-session';

interface Step {
  readonly activity: PlannedActivity;
  done: boolean;
}

/** The pause is offered in the middle of the day's plan, once. */
const PAUSE_AFTER = 2;
/** Close enough to a station to start without walking. */
const NEAR = 5;

/**
 * The day's plan: three short activities the child puts in order, a walk
 * between them, a pause in the middle and always the same ending.
 */
export class SessionController {
  readonly board: DayBoard;
  private steps: Step[] = [];
  /** The activity the child chose and is walking to. */
  private heading: Step | undefined;
  private rewarded = false;

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

  /** The first thing a child sees: what today will have. */
  async start(): Promise<void> {
    const plan = await this.ctx.player.planSession.execute();
    this.steps = plan.map((activity) => ({ activity, done: false }));
    this.rewarded = false;
    this.heading = undefined;
    this.open();
  }

  open(): void {
    if (this.steps.length === 0 || this.steps.every((step) => step.done)) {
      this.ctx.backToExploring(phrases.dayAllDone);
      return;
    }
    this.heading = undefined;
    this.ctx.setDestination(undefined);
    this.ctx.enterPanel('session');
    const finished = this.steps.filter((step) => step.done).length;
    this.board.show(this.view(), finished === PAUSE_AFTER - 1 || finished === PAUSE_AFTER);
    this.ctx.say(finished === 0 ? phrases.dayStart : phrases.dayNext);
  }

  /** Not now: the child goes exploring, and the plan stays in the menu. */
  later(): void {
    this.board.hide();
    this.ctx.backToExploring();
  }

  close(): void {
    this.heading = undefined;
    this.board.hide();
  }

  /** The child reached a station. True when this is the activity they chose. */
  async arrive(station: Station): Promise<boolean> {
    const step = this.heading;
    if (step?.activity.skill.station !== station) return false;
    this.heading = undefined;
    this.ctx.setDestination(undefined);
    await this.activities.openPlanned(step.activity, (finished) => {
      this.ended(step, finished);
    });
    return true;
  }

  private view(): DayStep[] {
    return this.steps.map(({ activity, done }) => {
      const look = stationLooks[activity.skill.station];
      return { icon: look.icon, name: activity.skill.name, color: look.color, done };
    });
  }

  private choose(index: number): void {
    const step = this.steps[index];
    if (step === undefined || step.done) return;
    this.heading = step;
    this.board.hide();
    const { station } = step.activity.skill;
    const place = this.ctx.world.places.find((p) => p.id === stationId(station));
    const near = place !== undefined && place.position.distanceTo(this.ctx.avatar.position) < NEAR;
    if (place === undefined || near) {
      void this.arrive(station);
      return;
    }
    this.ctx.setDestination(place);
    this.ctx.backToExploring();
    this.ctx.say(phrases.goToStation(stationLooks[station].name));
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
  }
}
