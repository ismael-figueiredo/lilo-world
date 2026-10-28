import * as THREE from 'three';
import { phrases } from '@application/use-cases/choose-mission-answer';
import type { MissionAttempt } from '@domain/mission/mission-attempt';
import type { GameContext } from '@presentation/game-context';
import { MissionPanel } from '@presentation/ui/mission-panel';
import { CITY, CityPlace, CROSSWALK } from '@presentation/world/city';
import { CrossingTracker, type CrossingEvent } from '@presentation/world/crosswalk';
import { EmotionsPlace } from '@presentation/world/emotions-garden';
import { HomePlace } from '@presentation/world/home-area';
import { NaturePlace } from '@presentation/world/nature-camp';
import { SchoolPlace } from '@presentation/world/school-area';

/** Where each mission happens in the open world. */
export const missionPlaces: Readonly<Record<string, string>> = {
  'city-market': CityPlace.market,
  'city-bakery': CityPlace.bakery,
  'city-bus': CityPlace.busStop,
  'city-crosswalk': CityPlace.crosswalk,
  'nature-animals': NaturePlace.farm,
  'nature-garden': NaturePlace.garden,
  'nature-recycling': NaturePlace.recycling,
  'home-hygiene': HomePlace.bathroom,
  'home-dressing': HomePlace.bedroom,
  'home-table': HomePlace.kitchen,
  'school-backpack': SchoolPlace.classroom,
  'school-talk': SchoolPlace.teacher,
  'school-turn': SchoolPlace.park,
  'emotions-faces': EmotionsPlace.faces,
  'emotions-stories': EmotionsPlace.stories,
  'emotions-calm': EmotionsPlace.calm,
};

/** What the crosswalk task reports, as the mission's choice ids. */
const crossingChoices: Readonly<Record<CrossingEvent, string>> = {
  waited: 'wait-green',
  crossed: 'cross',
  // Not a choice of the mission: counts as a gentle hint, never as a failure.
  rushed: 'stepped-on-red',
};

/** Runs a mission: request → action → celebration, with gentle hints. */
export class MissionController {
  readonly panel: MissionPanel;
  private attempt: MissionAttempt | undefined;
  private busy = false;
  private crossing: CrossingTracker | undefined;

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
    const { mission } = this.attempt;

    if (mission.kind === 'world-task') {
      // Played in the street: the world stays playable, the card shows the steps.
      this.crossing = new CrossingTracker(CROSSWALK);
      // Face the other sidewalk, where the walking figure can be seen.
      this.ctx.rig.yaw = this.ctx.avatar.position.z - CITY.z >= 0 ? 0 : Math.PI;
      this.panel.open(this.attempt);
      this.ctx.dialog.say(`${mission.introduction} ${this.attempt.currentStep?.prompt ?? ''}`);
      return;
    }

    this.ctx.enterPanel('mission');
    const place = this.ctx.world.places.find((p) => p.id === missionPlaces[missionId]);
    if (place !== undefined) {
      this.ctx.avatar.placeAt(place.position, 0);
      const { x, y, z } = place.position;
      // Look at the building from the street, whichever side of it the place is.
      const side =
        place.viewFrom === 'south'
          ? -1
          : place.viewFrom === 'north'
            ? 1
            : Math.sign(z - CITY.z) || 1;
      this.ctx.rig.setFocus(
        new THREE.Vector3(x - 3, y + 3.4, z - 8 * side),
        new THREE.Vector3(x, y + 2.2, z + 3 * side),
      );
    }
    this.panel.open(this.attempt);
    this.ctx.dialog.say(`${mission.introduction} ${this.attempt.currentStep?.prompt ?? ''}`);
  }

  /** Closes the mission (leaving early is recorded as practice, never as failure). */
  async exit(): Promise<void> {
    const attempt = this.attempt;
    this.attempt = undefined;
    this.crossing = undefined;
    this.panel.close();
    if (attempt !== undefined) await this.ctx.player.leaveMission.execute(attempt);
    this.ctx.backToExploring();
  }

  /** Hides the mission without recording it (e.g. when the player changes). */
  close(): void {
    this.attempt = undefined;
    this.crossing = undefined;
    this.panel.close();
  }

  /** Every frame while exploring: follows tasks played in the 3D world. */
  update(position: THREE.Vector3): void {
    const attempt = this.attempt;
    if (this.crossing === undefined || attempt === undefined || attempt.isCompleted) return;
    const waiting = attempt.currentStep?.targetId === 'wait-green';
    const event = this.crossing.update(
      position.x - CITY.x,
      position.z - CITY.z,
      this.ctx.world.trafficPhase.walk,
      waiting,
    );
    if (event !== undefined) void this.choose(crossingChoices[event]);
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
          const { mission } = this.attempt;
          if (mission.kind === 'world-task') {
            this.crossing = undefined;
            this.ctx.enterPanel('mission');
          }
          this.ctx.sound(reward.stars > 0 ? 'star' : 'coin');
          this.panel.collect(choiceId);
          this.panel.celebrate(reward, mission.result);
          if (mission.kind === 'build-sentence') {
            // The game says the child's request aloud, as an AAC device would.
            // Then the answer of whoever was asked (the baker, the teacher…).
            const answer = mission.farewell === undefined ? '' : ` ${mission.farewell}`;
            this.ctx.say(`${this.panel.sentence(this.attempt)}.${answer} Muito bem!`);
          } else {
            const { farewell } = mission;
            this.ctx.dialog.say(
              farewell === undefined ? phrases.completed : `${farewell} ${phrases.completed}`,
            );
          }
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
