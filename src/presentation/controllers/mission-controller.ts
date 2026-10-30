import * as THREE from 'three';
import { modelSentence, phrases, stepSentence } from '@application/use-cases/choose-mission-answer';
import type { MissionAttempt } from '@domain/mission/mission-attempt';
import type { GameContext } from '@presentation/game-context';
import { MissionPanel } from '@presentation/ui/mission-panel';
import type { Player } from '@presentation/actors/player';
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

/** The mission played inside the market, and who works at the cashier. */
const MARKET_MISSION = 'city-market';
const CASHIER_AVATAR = 'lis';

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
  /** True while the mission is played inside the market. */
  private indoors = false;
  private cashier: Player | undefined;

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
    if (mission.id === MARKET_MISSION) {
      await this.goInside(this.attempt);
      this.panel.open(this.attempt);
      this.ctx.dialog.say(`${mission.introduction} ${this.attempt.currentStep?.prompt ?? ''}`);
      return;
    }
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
    if (this.indoors) {
      await this.ctx.transition(() => {
        this.goOutside();
      });
    }
    if (attempt !== undefined) await this.ctx.player.leaveMission.execute(attempt);
    this.ctx.backToExploring();
  }

  /** Hides the mission without recording it (e.g. when the player changes). */
  close(): void {
    this.attempt = undefined;
    this.crossing = undefined;
    this.panel.close();
    if (this.indoors) this.goOutside();
  }

  /** The crossing mission follows the child itself. */
  get isCrossingStreet(): boolean {
    return this.crossing !== undefined;
  }

  /** Every frame: keeps the cashier breathing and waving. */
  tick(dt: number): void {
    this.cashier?.update(dt, { x: 0, z: 0 }, false, this.ctx.world);
  }

  /** Into the market: today's groceries on the shelves, the cart, the cashier. */
  private async goInside(attempt: MissionAttempt): Promise<void> {
    const market = this.ctx.world.market;
    this.cashier ??= await this.ctx.createCharacter(
      this.ctx.avatar.avatarId === CASHIER_AVATAR ? 'sam' : CASHIER_AVATAR,
    );
    const cashier = this.cashier;
    await this.ctx.transition(() => {
      market.stock(attempt.mission.choices.filter((choice) => choice.group === undefined));
      this.ctx.avatar.placeAt(market.shopperSpot, Math.PI);
      cashier.placeAt(market.cashierSpot, -Math.PI / 2);
      const view = market.shelfCamera;
      this.ctx.rig.setFocus(view.position, view.lookAt, true);
      this.indoors = true;
    });
    market.hint(attempt.currentStep?.targetId);
  }

  /** Back at the market's door, with the camera behind the child again. */
  private goOutside(): void {
    this.indoors = false;
    const door = this.ctx.world.places.find((p) => p.id === CityPlace.market);
    if (door === undefined) return;
    // The building is behind the door: the camera stays on the street side.
    const towardStreet = door.position.z > CITY.z ? Math.PI : 0;
    this.ctx.avatar.placeAt(door.position, towardStreet);
    this.ctx.rig.clearFocus();
    this.ctx.rig.yaw = towardStreet;
    this.ctx.rig.snapTo(door.position);
  }

  /** Inside the market the 3D shelf follows the panel: picks fly to the cart. */
  private showIndoors(choiceId: string, nextTargetId: string | undefined): void {
    if (!this.indoors || this.attempt === undefined) return;
    const market = this.ctx.world.market;
    market.collect(choiceId);
    market.hint(nextTargetId);
    const next = this.attempt.mission.choices.find((choice) => choice.id === nextTargetId);
    if (next?.group === 'cashier') {
      this.ctx.avatar.placeAt(market.checkoutSpot, Math.PI / 2);
      const view = market.checkoutCamera;
      this.ctx.rig.setFocus(view.position, view.lookAt);
    }
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
        case 'model':
          this.ctx.sound('hint');
          this.panel.showModel(outcome.step.targetId);
          if (this.indoors) this.ctx.world.market.hint(outcome.step.targetId);
          this.ctx.dialog.say(modelSentence(this.attempt, outcome.step));
          break;
        case 'correct':
          this.ctx.sound('correct');
          this.panel.next(this.attempt, choiceId);
          this.showIndoors(choiceId, outcome.nextStep.targetId);
          this.ctx.dialog.say(stepSentence(this.attempt, choiceId, outcome.nextStep));
          this.ctx.avatar.playEmote('Yes');
          break;
        case 'completed': {
          const reward = result.value.reward ?? { coins: 0, stars: 0 };
          const { mission } = this.attempt;
          if (mission.kind === 'world-task') {
            this.crossing = undefined;
            this.ctx.enterPanel('mission');
          }
          this.panel.next(this.attempt, choiceId);
          if (mission.kind === 'build-sentence') {
            // The child says it: the game speaks only when the button is pressed,
            // as a communication device would.
            const sentence = this.panel.sentence(this.attempt);
            this.ctx.dialog.say('Pronto! Agora é só falar.');
            if (!(await this.panel.waitForSpeak(sentence))) return;
            const answer = mission.farewell === undefined ? '' : ` ${mission.farewell}`;
            this.ctx.say(`${sentence}.${answer}`);
          }
          this.ctx.sound(reward.stars > 0 ? 'star' : 'coin');
          this.panel.celebrate(reward, mission.result);
          if (this.indoors) {
            this.showIndoors(choiceId, undefined);
            this.cashier?.playEmote('Wave');
          }
          if (mission.kind !== 'build-sentence') {
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
