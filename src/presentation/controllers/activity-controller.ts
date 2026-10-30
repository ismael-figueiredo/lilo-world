import * as THREE from 'three';
import { activityPhrases } from '@application/use-cases/answer-activity';
import type { ActivityRound } from '@domain/activity/activity-round';
import type { PlannedActivity } from '@domain/curriculum/session-plan';
import type { Station } from '@domain/curriculum/skill';
import type { GameContext } from '@presentation/game-context';
import { ActivityPanel, type RoundEnding } from '@presentation/ui/activity/activity-panel';
import { stationId, stationLooks } from '@presentation/world/stations';

/** Pause after a right answer, so the child sees the praise before the next question. */
const NEXT_QUESTION_MS = 1300;
/** A sticker takes longer to say, and the next question must not cut it off. */
const AFTER_STICKER_MS = 2800;
/** No answer yet: say it again, then show how. Never a pressure and never a mistake. */
const REPEAT_AFTER_MS = 8000;
const SHOW_AFTER_MS = 15_000;
/** Second question of a new skill: help comes sooner, then it fades. */
const SHOW_SOON_MS = 3000;

/** How a planned activity ends: `finished` is false when the child left early. */
type OnPlannedEnd = (finished: boolean) => void;

interface Plan {
  readonly activity: PlannedActivity;
  readonly onEnd: OnPlannedEnd;
  finished: boolean;
}

/** Runs an activity: a calm stream of questions at the child's own level. */
export class ActivityController {
  readonly panel: ActivityPanel;
  private round: ActivityRound | undefined;
  private busy = false;
  private station: Station | undefined;
  private roundCoins = 0;
  private plan: Plan | undefined;
  private readonly timers: number[] = [];

  constructor(private readonly ctx: GameContext) {
    this.panel = new ActivityPanel({
      onChoose: (answerId) => void this.choose(answerId),
      onAgain: () => {
        if (this.station !== undefined) void this.open(this.station);
      },
      onExit: () => {
        this.exit();
      },
      onRepeat: () => {
        const round = this.round;
        if (round === undefined) return;
        this.ctx.say(round.isModeling ? round.item.teach.text : round.item.prompt.text);
      },
    });
    // Any move of the child means they are working: the help can wait.
    for (const type of ['pointerdown', 'keydown']) {
      this.panel.element.addEventListener(type, () => {
        this.watchForHelp();
      });
    }
  }

  /** Free practice at a station, at the level the child reached. */
  async open(station: Station): Promise<void> {
    this.plan = undefined;
    const round = await this.ctx.player.startActivity.execute(station);
    this.begin(station, round);
    this.ctx.dialog.say(round.item.prompt.text);
    this.watchForHelp();
  }

  /** One activity of the day's plan. A new skill starts by seeing how it is done. */
  async openPlanned(activity: PlannedActivity, onEnd: OnPlannedEnd): Promise<void> {
    const round = await this.ctx.player.startActivity.planned(activity);
    this.plan = { activity, onEnd, finished: false };
    this.begin(activity.skill.station, round);
    if (activity.isNew) this.demonstrate();
    else {
      this.ctx.say(round.item.prompt.text);
      this.watchForHelp();
    }
  }

  exit(): void {
    const plan = this.plan;
    this.close();
    if (plan === undefined) this.ctx.backToExploring();
    else plan.onEnd(plan.finished);
  }

  close(): void {
    this.stopWatching();
    this.round = undefined;
    this.plan = undefined;
    this.panel.close();
  }

  private begin(station: Station, round: ActivityRound): void {
    this.round = round;
    this.station = station;
    this.roundCoins = 0;
    this.ctx.enterPanel('learning');
    const place = this.ctx.world.places.find((p) => p.id === stationId(station));
    if (place !== undefined) {
      this.ctx.avatar.placeAt(place.position, 0);
      const { x, y, z } = place.position;
      // From the street side (main street at z = 0), looking at the station.
      const side = Math.sign(z) || 1;
      this.ctx.rig.setFocus(
        new THREE.Vector3(x + 2.5, y + 3.4, z - 6 * side),
        new THREE.Vector3(x, y + 1.4, z + 2.6 * side),
      );
    }
    this.panel.open(stationLooks[station], round);
  }

  private stopWatching(): void {
    for (const timer of this.timers.splice(0)) window.clearTimeout(timer);
  }

  /** Schedules the help for the current question, from now. */
  private watchForHelp(): void {
    this.stopWatching();
    const round = this.round;
    if (round === undefined || round.isModeling || this.busy) return;
    const later = (ms: number, action: () => void) => {
      this.timers.push(
        window.setTimeout(() => {
          if (!document.hidden && this.ctx.mode === 'learning') action();
        }, ms),
      );
    };
    const secondOfNew = this.plan?.activity.isNew === true && round.asked === 1;
    if (!secondOfNew) {
      later(REPEAT_AFTER_MS, () => {
        this.ctx.say(round.item.prompt.text);
      });
    }
    later(secondOfNew ? SHOW_SOON_MS : SHOW_AFTER_MS, () => {
      this.demonstrate();
    });
  }

  /** Shows how it is done. Not a mistake: nothing counts against the child. */
  private demonstrate(): void {
    const round = this.round?.demonstrate();
    if (round === undefined) return;
    this.round = round;
    this.stopWatching();
    this.panel.showAnswer();
    this.ctx.say(round.item.teach.text);
  }

  private ending(): RoundEnding {
    if (this.plan !== undefined) return 'onward';
    return this.ctx.restIsDue ? 'leave-only' : 'again';
  }

  private async choose(answerId: string): Promise<void> {
    const current = this.round;
    if (this.busy || current === undefined) return;
    this.busy = true;
    this.stopWatching();
    try {
      const result = await this.ctx.player.answerActivity.execute(current, answerId);
      this.round = result.round;
      const { outcome } = result;
      if (outcome.kind === 'model') {
        this.ctx.sound('hint');
        this.panel.showAnswer();
        this.ctx.dialog.say(current.item.teach.text);
        return;
      }

      this.roundCoins += result.reward.coins;
      const firstTry = outcome.kind === 'correct';
      this.ctx.sound(result.reward.stars > 0 ? 'star' : firstTry ? 'correct' : 'tap');
      const praise =
        result.sticker !== undefined
          ? activityPhrases.sticker
          : firstTry
            ? `${activityPhrases.correct} 🪙 +${result.reward.coins}`
            : activityPhrases.practiced;
      this.panel.celebrate(praise, result.sticker);
      if (firstTry) this.ctx.avatar.playEmote('Yes');
      await this.ctx.refresh();

      const pause = result.sticker === undefined ? NEXT_QUESTION_MS : AFTER_STICKER_MS;
      await new Promise((resolve) => window.setTimeout(resolve, pause));
      if (this.round !== result.round) return;
      this.panel.hideToast();
      if (outcome.summary !== undefined) {
        if (this.plan !== undefined) this.plan.finished = true;
        this.panel.showResult(outcome.summary, this.roundCoins, this.ending());
        if (outcome.summary.reachedLevel !== undefined) this.ctx.avatar.playEmote('Dance');
        this.ctx.dialog.say(
          outcome.summary.shortened === true
            ? 'Por hoje está ótimo!'
            : `Você acertou ${outcome.summary.score} de ${outcome.summary.total}.`,
        );
        return;
      }
      this.panel.render(result.round);
      // Said now, with the new answers on screen, so voice and picture go together.
      this.ctx.say(result.round.item.prompt.text);
    } finally {
      this.busy = false;
      this.watchForHelp();
    }
  }
}
