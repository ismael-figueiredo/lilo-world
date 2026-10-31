import type * as THREE from 'three';
import { rideSeconds } from '@domain/city/bus';
import { phrases } from '@application/phrases';
import type { PlannedActivity } from '@domain/curriculum/session-plan';
import {
  afterAsking,
  firstSchoolStage,
  schoolStageAfterSnack,
  lineAfter,
  nextSchoolStage,
  schoolStages,
  type Need,
  type SchoolStage,
} from '@domain/school/school-day';
import type { ActivityController } from '@presentation/controllers/activity-controller';
import type { HomeController } from '@presentation/controllers/home-controller';
import { PlayController } from '@presentation/controllers/play-controller';
import type { GameContext } from '@presentation/game-context';
import type { Player } from '@presentation/actors/player';
import { CityPlace } from '@presentation/world/city';
import { standingGround } from '@presentation/world/neighbors';
import type { SchoolBuilding } from '@presentation/world/school-building';
import { BUS_STOP } from '@presentation/world/street-layout';
import { schoolSpotOf } from '@presentation/world/market-position';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const STEP_MS = 1400;
const BUS_PATIENCE_MS = 14_000;
const GET_OFF_SECONDS = 2;
const SEAT_HEIGHT = 0.3;
const ACTIVITIES_IN_CLASS = 2;
const LINE_MS = 2200;
const AHEAD = 2;
const FACE_SOUTH = 0;
const FACE_NORTH = Math.PI;

const needs: readonly { readonly id: Need; readonly icon: string; readonly label: string }[] = [
  { id: 'toilet', icon: '🚻', label: 'Ir ao banheiro' },
  { id: 'help', icon: '🙋', label: 'Ajuda' },
  { id: 'water', icon: '💧', label: 'Beber água' },
];

const snacks = [
  { id: 'apple', icon: '🍎', label: 'Maçã' },
  { id: 'bread', icon: '🥪', label: 'Sanduíche' },
  { id: 'juice', icon: '🧃', label: 'Suco' },
];

/** The school's own agenda, from the bus stop to the bus home, saved at each stage. */
export class SchoolController {
  private building: SchoolBuilding | undefined;
  private readonly play: PlayController;
  private teacher: Player | undefined;
  private classmates: Player[] = [];
  private driver: Player | undefined;
  private passenger: { readonly character: Player; left: number } | undefined;

  constructor(
    private readonly ctx: GameContext,
    private readonly home: HomeController,
    private readonly activities: ActivityController,
  ) {
    this.play = new PlayController(ctx, home);
  }

  private get stage(): SchoolStage | undefined {
    if (this.home.step !== 'school') return undefined;
    return this.home.schoolStage ?? firstSchoolStage;
  }

  private get atSchool(): boolean {
    return this.building !== undefined && this.ctx.world.inside === this.building;
  }

  private get hereIs(): SchoolStage | undefined {
    const { stage } = this;
    if (stage === undefined) return undefined;
    // A game closed halfway opens at home: the day goes back through the bus.
    return this.atSchool ? stage : 'stop';
  }

  get goalPlaceId(): string | undefined {
    const stage = this.hereIs;
    if (stage === undefined) return undefined;
    if (!this.atSchool) return CityPlace.busStop;
    if (stage === 'recess' && this.play.isOut) return this.play.hasPlayed ? 'play:back' : undefined;
    return schoolSpotOf[stage];
  }

  get tip(): string | undefined {
    switch (this.hereIs) {
      case undefined:
        return undefined;
      case 'greet':
        return phrases.toTeacher;
      case 'backpack':
        return phrases.toCubby;
      case 'seat':
        return phrases.toDesk;
      case 'toilet':
        return phrases.toToilet;
      case 'snack':
        return phrases.toCanteen;
      case 'pe':
        return phrases.toCourt;
      case 'recess':
        return this.play.isOut ? phrases.chooseGame : phrases.toYard;
      case 'leave':
        return phrases.toExit;
      default:
        return phrases.goToStop;
    }
  }

  /** The action button at a place of the school day. False for anything else. */
  async use(placeId: string): Promise<boolean> {
    const stage = this.hereIs;
    if (stage === undefined) return false;
    if (placeId === CityPlace.busStop && stage === 'stop') {
      await this.catchBus();
      return true;
    }
    if (!this.atSchool) return false;
    if (placeId.startsWith('play:')) {
      await this.playAt(placeId);
      return true;
    }
    if (schoolSpotOf[stage] !== placeId) {
      if (!placeId.startsWith('escola:')) return false;
      this.ctx.say(this.tip ?? phrases.toExit);
      return true;
    }
    await this.doStage(stage);
    return true;
  }

  private async doStage(stage: SchoolStage): Promise<void> {
    switch (stage) {
      case 'greet':
        await this.greet();
        return;
      case 'backpack':
        await this.storeBackpack();
        return;
      case 'seat':
        await this.haveClass();
        return;
      case 'toilet':
        await this.useToilet();
        return;
      case 'snack':
        await this.haveSnack();
        return;
      case 'pe':
        await this.haveSports();
        return;
      case 'recess':
        await this.goToRecess();
        return;
      case 'leave':
        await this.goHome();
        return;
      default:
        return;
    }
  }

  /** Physical education: warming up, then the sport of the day, on the court. */
  private async haveSports(): Promise<void> {
    const { ctx, building } = this;
    if (building === undefined) return;
    await this.play.goOut(building, this.classmates);
    ctx.enterPanel('home');
    ctx.say(phrases.warmUp);
    const moves = [
      { icon: '🙆', label: 'Braços' },
      { icon: '🦵', label: 'Pernas' },
      { icon: '🏃', label: 'Correr' },
    ];
    for (const [index] of moves.entries()) {
      await this.home.sheet.press(moves, index);
      ctx.avatar.playEmote('Dance');
      await wait(STEP_MS);
    }
    ctx.say(phrases.warmDone);
    await wait(STEP_MS);
    await this.play.sport(this.home.dayNumber);
    await this.save(nextSchoolStage('pe'));
    ctx.backToExploring(this.tip);
  }

  private async goToRecess(): Promise<void> {
    const { building } = this;
    if (building === undefined) return;
    await this.play.goOut(building, this.classmates);
    await this.play.invite(this.home.dayNumber);
    this.ctx.backToExploring(this.tip);
    this.ctx.refreshGoal();
  }

  private async playAt(placeId: string): Promise<void> {
    if (placeId === 'play:back') {
      if (this.hereIs !== 'recess') return;
      if (this.ctx.settings.feelingScenes) {
        const { FeelingsController } =
          await import('@presentation/controllers/feelings-controller');
        await new FeelingsController(this.ctx, this.home).playToday(
          this.classmates[0],
          this.classmates[1],
        );
      }
      this.ctx.say(phrases.bellRings);
      await this.play.goBack();
      await this.save(nextSchoolStage('recess'));
      this.ctx.backToExploring(this.tip);
      return;
    }
    await this.play.game(placeId, this.home.dayNumber);
    this.ctx.backToExploring(this.tip);
    this.ctx.refreshGoal();
  }

  /** Every frame: the one who got off the bus walks away. */
  update(dt: number): void {
    this.play.update(dt);
    const { passenger } = this;
    if (passenger === undefined) return;
    passenger.left -= dt;
    passenger.character.update(dt, { x: 0.3, z: -1 }, false, standingGround(this.ctx.world));
    if (passenger.left <= 0) {
      passenger.character.root.visible = false;
      this.passenger = undefined;
    }
  }

  private async save(stage: SchoolStage): Promise<void> {
    await this.ctx.player.followDay.saveSchool(stage);
    this.home.setDay(await this.ctx.player.followDay.load());
    this.ctx.refreshGoal();
  }

  private people(): void {
    this.teacher ??= this.ctx.addClassmate('teacher');
    this.driver ??= this.ctx.addClassmate('driver');
    if (this.classmates.length === 0) {
      this.classmates = [
        this.ctx.addClassmate('classmateAna'),
        this.ctx.addClassmate('classmateTeo'),
        this.ctx.addClassmate('classmateJu'),
      ];
    }
  }

  private sit(character: Player, at: THREE.Vector3, facing: number): void {
    character.setPerch(SEAT_HEIGHT);
    character.release();
    character.placeAt(at, facing);
    if (character.canDo('Sit')) character.playEmote('Sit');
  }

  private stand(character: Player, at: THREE.Vector3, facing: number): void {
    character.setPerch(0);
    character.release();
    character.placeAt(at, facing);
  }

  private catchBus(): Promise<void> {
    return this.takeBus(() => this.reachSchool());
  }

  /** At the stop: wait, let people off, get on, and ride to wherever `arrive` leads. */
  async takeBus(arrive: () => Promise<void>): Promise<void> {
    const { ctx } = this;
    ctx.enterPanel('home');
    const stop = ctx.world.places.find((place) => place.id === CityPlace.busStop);
    // Looking down the street, where the bus comes from, with the stop at hand.
    if (stop !== undefined) ctx.avatar.placeAt(stop.position, Math.PI / 2);
    ctx.rig.yaw = -Math.PI / 2;
    ctx.letLookAround();
    const { town } = ctx;
    const street = town.bus;
    street.callBus();
    ctx.say(phrases.waitBus);
    const waited = Date.now();
    while (!street.busAtStop && Date.now() - waited < BUS_PATIENCE_MS) await wait(200);
    if (!street.busAtStop) street.bringBusNow();
    ctx.say(phrases.letOff);
    const character = ctx.addPerson('student');
    character.root.visible = true;
    character.placeAt(
      stop?.position.clone().setZ(BUS_STOP.signZ) ?? ctx.avatar.position,
      FACE_NORTH,
    );
    this.passenger = { character, left: GET_OFF_SECONDS };
    await wait(GET_OFF_SECONDS * 1000 + 400);
    ctx.say(phrases.boardBus);
    await this.home.sheet.press([{ icon: '🚌', label: 'Entrar' }], 0);
    await this.ride(arrive);
  }

  private async ride(arrive: () => Promise<void>): Promise<void> {
    const { ctx } = this;
    const { town } = ctx;
    const bus = await ctx.whileLoading(town.prepareBus());
    this.people();
    await ctx.transition(() => {
      town.bus.sendBusAway();
      ctx.enterSpace(bus);
      ctx.avatar.placeAt(bus.reader, -Math.PI / 2);
      const view = bus.camera;
      ctx.rig.setFocus(view.position, view.lookAt, true);
      this.classmates.forEach((friend, index) => {
        this.sit(friend, bus.seatOf(index), Math.PI / 2);
      });
      if (this.driver !== undefined) this.sit(this.driver, bus.driver, Math.PI / 2);
    });
    ctx.say(phrases.passCard);
    await this.home.sheet.press([{ icon: '💳', label: 'Passar o cartão' }], 0);
    ctx.avatar.playEmote('Pick');
    ctx.sound('coin');
    await wait(STEP_MS);
    ctx.say(phrases.sitOnBus);
    await this.home.sheet.press([{ icon: '💺', label: 'Sentar' }], 0);
    this.sit(ctx.avatar, bus.seat, Math.PI / 2);
    bus.setMoving(true);
    ctx.say(phrases.lookOutside);
    await wait(rideSeconds(ctx.settings.shortRides) * 1000);
    bus.setMoving(false);
    ctx.say(phrases.pressStop);
    await this.home.sheet.press([{ icon: '🔔', label: 'Apertar o botão' }], 0);
    ctx.sound('tap');
    await arrive();
  }

  private async reachSchool(): Promise<void> {
    const { ctx } = this;
    const school = await ctx.whileLoading(ctx.town.prepareSchool());
    this.building = school;
    const saved = this.stage ?? 'stop';
    await ctx.transition(() => {
      this.stand(ctx.avatar, school.entrance, FACE_NORTH);
      ctx.rig.clearFocus();
      ctx.enterSpace(school);
      if (this.teacher !== undefined) this.stand(this.teacher, school.teacherSpot, FACE_SOUTH);
      this.classmates.forEach((friend, index) => {
        this.sit(friend, school.deskOf(index), FACE_NORTH);
      });
    });
    const arrived = schoolStages.indexOf(saved) < schoolStages.indexOf('greet') ? 'greet' : saved;
    await this.save(arrived);
    ctx.backToExploring(this.tip);
    ctx.refreshGoal();
  }

  private async greet(): Promise<void> {
    const { ctx } = this;
    ctx.enterPanel('home');
    ctx.avatar.playEmote('Wave');
    this.teacher?.playEmote('Wave');
    ctx.say(phrases.teacherHello(ctx.profile.name));
    await wait(STEP_MS * 2);
    await this.save(nextSchoolStage('greet'));
    ctx.backToExploring(this.tip);
  }

  private async storeBackpack(): Promise<void> {
    const { ctx } = this;
    ctx.enterPanel('home');
    await this.home.sheet.press([{ icon: '🎒', label: 'Guardar a mochila' }], 0);
    ctx.avatar.playEmote('Pick');
    await wait(STEP_MS);
    await this.save(nextSchoolStage('backpack'));
    ctx.backToExploring(this.tip);
  }

  /** The class is the study of the game, at the child's own desk at school. */
  private async haveClass(): Promise<void> {
    const { ctx, building } = this;
    if (building === undefined) return;
    ctx.enterPanel('home');
    this.sit(ctx.avatar, building.seatSpot, FACE_NORTH);
    if (this.teacher !== undefined) {
      this.stand(this.teacher, building.at({ x: -9, z: -11.8 }), FACE_SOUTH);
    }
    ctx.say(phrases.classStart);
    await wait(STEP_MS);
    const plan = await ctx.player.planSession.execute();
    for (const activity of plan.slice(0, ACTIVITIES_IN_CLASS)) await this.study(activity);
    ctx.enterPanel('home');
    ctx.say(phrases.classDone);
    await wait(STEP_MS);
    await this.ask(building);
  }

  private study(activity: PlannedActivity): Promise<void> {
    return new Promise((resolve) => {
      void this.activities.openPlanned(activity, () => {
        resolve();
      });
    });
  }

  /** Real communication: the child says what they need, and every answer is right. */
  private async ask(building: SchoolBuilding): Promise<void> {
    const { ctx } = this;
    await this.save('ask');
    ctx.say(phrases.askTeacher);
    const chosen = await this.home.sheet.choose(phrases.iNeed, needs);
    const need = needs.find((option) => option.id === chosen)?.id ?? 'help';
    const { said, answer } = {
      toilet: { said: phrases.saidToilet, answer: phrases.answerToilet },
      help: { said: phrases.saidHelp, answer: phrases.answerHelp },
      water: { said: phrases.saidWater, answer: phrases.answerWater },
    }[need];
    ctx.say(said);
    await wait(STEP_MS);
    this.teacher?.playEmote('Yes');
    ctx.say(answer);
    await wait(STEP_MS * 2);
    this.stand(ctx.avatar, building.seatSpot, FACE_NORTH);
    await this.save(afterAsking(need));
    ctx.backToExploring(this.tip);
  }

  private async useToilet(): Promise<void> {
    const { ctx } = this;
    ctx.enterPanel('home');
    await this.home.sheet.press([{ icon: '🧼', label: 'Lavar as mãos' }], 0);
    ctx.avatar.playEmote('Wash');
    await wait(STEP_MS);
    ctx.say(phrases.toiletDone);
    await this.save('snack');
    ctx.backToExploring(this.tip);
  }

  /** Waiting one's turn: the line moves by itself, calmly, and nobody can pass. */
  private async haveSnack(): Promise<void> {
    const { ctx, building } = this;
    if (building === undefined) return;
    ctx.enterPanel('home');
    const [first, second, friend] = this.classmates;
    const line = [first, second].filter((who) => who !== undefined);
    line.forEach((who, index) => {
      this.stand(who, building.linePlace(index), FACE_SOUTH);
    });
    this.stand(ctx.avatar, building.linePlace(AHEAD), FACE_SOUTH);
    ctx.say(phrases.waitInLine);
    let ahead = AHEAD;
    while (ahead > 0) {
      await wait(LINE_MS);
      ahead = lineAfter(ahead);
      line.forEach((who, index) => {
        who.root.visible = index >= AHEAD - ahead;
        who.placeAt(building.linePlace(index - (AHEAD - ahead)), FACE_SOUTH);
      });
      ctx.avatar.placeAt(building.linePlace(ahead), FACE_SOUTH);
    }
    ctx.say(phrases.yourTurn);
    await wait(STEP_MS);
    ctx.say(phrases.chooseSnack);
    await this.home.sheet.choose(phrases.chooseSnack, snacks);
    ctx.avatar.playEmote('Pick');
    await wait(STEP_MS);
    ctx.say(phrases.sitWithFriend);
    this.sit(ctx.avatar, building.tableSpot, FACE_SOUTH);
    if (friend !== undefined) this.sit(friend, building.friendSpot, FACE_SOUTH);
    await wait(STEP_MS);
    ctx.say(phrases.friendHello);
    if (ctx.avatar.canDo('SitEat')) ctx.avatar.playEmote('SitEat');
    await wait(STEP_MS * 2);
    for (const who of line) who.root.visible = true;
    this.stand(ctx.avatar, building.tableSpot, FACE_NORTH);
    await this.save(schoolStageAfterSnack(this.home.dayNumber));
    ctx.backToExploring(this.tip);
  }

  /** The way back is short: the long trip was already seen today. */
  private async goHome(): Promise<void> {
    const { ctx } = this;
    ctx.enterPanel('home');
    await ctx.transition(() => {
      ctx.leaveSpace(CityPlace.home);
    });
    await this.home.backFromSchool();
    ctx.refreshGoal();
  }

  close(): void {
    this.passenger = undefined;
  }
}
