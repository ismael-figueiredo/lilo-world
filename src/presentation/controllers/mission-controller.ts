import * as THREE from 'three';
import { phrases } from '@application/use-cases/choose-mission-answer';
import type { MissionAttempt } from '@domain/mission/mission-attempt';
import type { GameContext } from '@presentation/game-context';
import { MissionPanel } from '@presentation/ui/mission-panel';
import { CityPlace } from '@presentation/world/city';

/** Where each mission happens in the open world. */
export const missionPlaces: Readonly<Record<string, string>> = { 'city-market': CityPlace.market };

/** Runs a mission: request → action → celebration, with gentle hints. */
export class MissionController {
  readonly panel: MissionPanel;
  private attempt: MissionAttempt | undefined;
  private busy = false;

  constructor(private readonly ctx: GameContext) {
    this.panel = new MissionPanel({
      onChoose: (choiceId) => void this.choose(choiceId),
      onExit: () => void this.exit(),
      onReplay: () => {
        if (this.attempt !== undefined) void this.open(this.attempt.mission.id);
      },
    });
  }

  get isRunning(): boolean {
    return this.attempt !== undefined && !this.attempt.isCompleted;
  }

  async open(missionId: string): Promise<void> {
    const result = await this.ctx.player.startMission.execute(missionId);
    if (!result.ok) {
      this.ctx.say('Essa missão ainda não está pronta.');
      return;
    }
    this.attempt = result.value;
    this.ctx.enterPanel('mission');

    const place = this.ctx.world.places.find((p) => p.id === missionPlaces[missionId]);
    if (place !== undefined) {
      this.ctx.avatar.placeAt(place.position, 0);
      const { x, y, z } = place.position;
      this.ctx.rig.setFocus(
        new THREE.Vector3(x - 3, y + 3.4, z - 8),
        new THREE.Vector3(x, y + 2.2, z + 3),
      );
    }
    this.panel.open(this.attempt);
    const { mission } = this.attempt;
    this.ctx.dialog.say(`${mission.introduction} ${this.attempt.currentStep?.prompt ?? ''}`);
  }

  /** Closes the mission (leaving early is recorded as practice, never as failure). */
  async exit(): Promise<void> {
    const attempt = this.attempt;
    this.attempt = undefined;
    this.panel.close();
    if (attempt !== undefined) await this.ctx.player.leaveMission.execute(attempt);
    this.ctx.backToExploring();
  }

  close(): void {
    this.panel.close();
  }

  private async choose(choiceId: string): Promise<void> {
    if (this.busy || this.attempt === undefined) return;
    this.busy = true;
    try {
      const result = await this.ctx.player.chooseMissionAnswer.execute(this.attempt, choiceId);
      if (!result.ok) return;
      this.attempt = result.value.attempt;
      const { outcome } = result.value;

      switch (outcome.kind) {
        case 'hint':
          this.ctx.sound('hint');
          this.panel.showHint(outcome.step.targetId, outcome.hintLevel);
          this.ctx.dialog.say(`${phrases.hint} ${outcome.step.prompt}`);
          break;
        case 'correct':
          this.ctx.sound('correct');
          this.panel.collect(choiceId, outcome.nextStep.targetId);
          this.ctx.dialog.say(`${phrases.correct} ${outcome.nextStep.prompt}`);
          this.ctx.avatar.playEmote('Yes');
          break;
        case 'completed': {
          const reward = result.value.reward ?? { coins: 0, stars: 0 };
          this.ctx.sound(reward.stars > 0 ? 'star' : 'coin');
          this.panel.collect(choiceId);
          this.panel.celebrate(reward);
          this.ctx.dialog.say(phrases.completed);
          this.ctx.avatar.playEmote('Dance');
          await this.ctx.refresh();
          break;
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
