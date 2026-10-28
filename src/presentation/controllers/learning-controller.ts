import * as THREE from 'three';
import { challengePhrases } from '@application/use-cases/answer-challenge';
import type { Skill } from '@domain/learning/challenge';
import type { ChallengeSession } from '@domain/learning/challenge-session';
import type { GameContext } from '@presentation/game-context';
import { ChallengePanel } from '@presentation/ui/challenge-panel';
import { stationId, stationLooks } from '@presentation/world/stations';

/** Pause after a right answer, so the child sees the praise before the next question. */
const NEXT_QUESTION_MS = 1300;

/** Runs a learning station: a calm stream of challenges at the child's own level. */
export class LearningController {
  readonly panel: ChallengePanel;
  private session: ChallengeSession | undefined;
  private busy = false;

  constructor(private readonly ctx: GameContext) {
    this.panel = new ChallengePanel({
      onChoose: (optionId) => void this.choose(optionId),
      onExit: () => {
        this.exit();
      },
    });
  }

  async open(skill: Skill): Promise<void> {
    this.session = await this.ctx.player.startChallenge.execute(skill);
    this.ctx.enterPanel('learning');
    const place = this.ctx.world.places.find((p) => p.id === stationId(skill));
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
    this.panel.open(stationLooks[skill], this.session);
    this.ctx.dialog.say(this.session.challenge.question);
  }

  exit(): void {
    this.session = undefined;
    this.panel.close();
    this.ctx.backToExploring();
  }

  close(): void {
    this.session = undefined;
    this.panel.close();
  }

  private async choose(optionId: string): Promise<void> {
    const current = this.session;
    if (this.busy || current === undefined) return;
    this.busy = true;
    try {
      const result = await this.ctx.player.answerChallenge.execute(current, optionId);
      this.session = result.session;
      const { outcome } = result;
      if (outcome.kind === 'hint') {
        this.ctx.sound('hint');
        this.panel.showHint(current.challenge.answerId, outcome.hintLevel);
        this.ctx.dialog.say(`${challengePhrases.hint} ${current.challenge.question}`);
        return;
      }

      const leveledUp = outcome.reachedLevel !== undefined;
      this.ctx.sound(result.reward.stars > 0 ? 'star' : 'correct');
      const praise = leveledUp
        ? `${challengePhrases.levelUp} ⭐`
        : result.sticker !== undefined
          ? challengePhrases.sticker
          : `${challengePhrases.correct} 🪙 +${result.reward.coins}`;
      this.panel.celebrate(praise, result.sticker);
      this.ctx.avatar.playEmote(leveledUp ? 'Dance' : 'Yes');
      await this.ctx.refresh();

      await new Promise((resolve) => window.setTimeout(resolve, NEXT_QUESTION_MS));
      if (this.session !== result.session) return;
      this.panel.hideToast();
      this.panel.render(result.session);
      this.ctx.dialog.say(result.session.challenge.question);
    } finally {
      this.busy = false;
    }
  }
}
