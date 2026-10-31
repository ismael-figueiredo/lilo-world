import type * as THREE from 'three';
import { phrases } from '@application/phrases';
import {
  ballArc,
  CATCHES,
  hidingPlaces,
  HOPSCOTCH_SQUARES,
  inviteOf,
  peSport,
  ROPE_JUMPS,
  shotHits,
  TRIES,
} from '@domain/play/games';
import type { HomeController } from '@presentation/controllers/home-controller';
import type { Player } from '@presentation/actors/player';
import type { GameContext } from '@presentation/game-context';
import type { SchoolBuilding } from '@presentation/world/school-building';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const BALL_SECONDS = 0.9;
const STEP_MS = 1100;
const AIM_SECONDS = 1.1;
const CALM_AIM_SECONDS = 2;
const TURN_MS = 3000;
const FOUND_RANGE = 2.2;
const FACE_NORTH = Math.PI;

const friendNames = ['Ana', 'Teo', 'Ju'];

interface Flight {
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
  readonly height: number;
  readonly done: () => void;
  age: number;
}

/**
 * The yard: every game has the same shape, a rule in pictures, a few turns and
 * a happy end. Nobody loses, and nothing here is timed against the child.
 */
export class PlayController {
  private building: SchoolBuilding | undefined;
  private friends: readonly Player[] = [];
  private flight: Flight | undefined;
  private played = false;
  private seeking: Player[] = [];

  constructor(
    private readonly ctx: GameContext,
    private readonly home: HomeController,
  ) {}

  get isOut(): boolean {
    return this.building !== undefined;
  }

  get hasPlayed(): boolean {
    return this.played;
  }

  /** Out to the yard, with the friends. */
  async goOut(building: SchoolBuilding, friends: readonly Player[]): Promise<void> {
    this.building = building;
    this.friends = friends;
    this.played = false;
    this.ctx.enterPanel('home');
    await this.ctx.transition(() => {
      this.ctx.avatar.setPerch(0);
      this.ctx.avatar.release();
      this.ctx.avatar.placeAt(building.yardSpot('arrive'), FACE_NORTH);
      friends.forEach((friend, index) => {
        friend.root.visible = true;
        friend.setPerch(0);
        friend.release();
        friend.placeAt(
          building.yardSpot('arrive').setX(building.yardSpot('arrive').x + 2 + index),
          0,
        );
      });
      this.ctx.rig.snapTo(this.ctx.avatar.position);
    });
  }

  async goBack(): Promise<void> {
    const { building } = this;
    if (building === undefined) return;
    this.ctx.enterPanel('home');
    await this.ctx.transition(() => {
      this.ctx.avatar.placeAt(building.at({ x: 15, z: 0 }), -Math.PI / 2);
      this.ctx.rig.snapTo(this.ctx.avatar.position);
    });
    this.building = undefined;
  }

  /** Calling a friend: any answer is fine, and someone always says yes. */
  async invite(dayNumber: number): Promise<void> {
    const { ctx } = this;
    ctx.enterPanel('home');
    const left = this.friends.map((_, index) => index);
    for (;;) {
      ctx.say(phrases.inviteWho);
      const chosen = await this.home.sheet.choose(
        phrases.inviteWho,
        left.map((index) => ({
          id: String(index),
          icon: '🧒',
          label: friendNames[index] ?? 'Colega',
        })),
      );
      const friend = Number(chosen);
      const last = left.length === 1;
      const answer = inviteOf(friend, dayNumber, last);
      ctx.avatar.playEmote('Wave');
      this.friends[friend]?.playEmote(answer === 'yes' ? 'Yes' : 'Wave');
      ctx.say(
        answer === 'yes'
          ? phrases.inviteYes
          : answer === 'later'
            ? phrases.inviteLater
            : phrases.inviteNo,
      );
      await wait(STEP_MS * 2);
      if (answer === 'yes') break;
      left.splice(left.indexOf(friend), 1);
      ctx.say(phrases.inviteOther);
      await wait(STEP_MS);
    }
    ctx.say(phrases.chooseGame);
  }

  sport(dayNumber: number): Promise<void> {
    return peSport(dayNumber) === 'soccer' ? this.soccer() : this.basketball();
  }

  async game(placeId: string, dayNumber: number): Promise<void> {
    const games: Readonly<Record<string, () => Promise<void>>> = {
      'play:basket': () => this.basketball(),
      'play:soccer': () => this.soccer(),
      'play:hide': () => this.hideAndSeek(dayNumber),
      'play:hopscotch': () => this.hopscotch(),
      'play:catch': () => this.catchBall(),
      'play:rope': () => this.rope(),
      'play:swing': () => this.turnOn('Sit', phrases.swingDone),
      'play:slide': () => this.turnOn('Sit', phrases.slideDone),
      'play:seesaw': () => this.turnOn('Sit', phrases.seesawDone),
    };
    await games[placeId]?.();
    this.played = true;
    this.ctx.enterPanel('home');
    this.ctx.avatar.playEmote('Dance');
    this.ctx.say(phrases.gameDone);
    await wait(STEP_MS * 2);
  }

  /** Every frame: the ball in the air, and the friends being found. */
  update(dt: number): void {
    const { flight, building } = this;
    if (flight !== undefined && building !== undefined) {
      flight.age += dt / BALL_SECONDS;
      const { x, y, z } = ballArc(flight.from, flight.to, flight.height, flight.age);
      building.moveBall(x, y, z);
      if (flight.age >= 1) {
        this.flight = undefined;
        flight.done();
      }
    }
  }

  private throwBall(from: THREE.Vector3, to: THREE.Vector3, height: number): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        window.clearTimeout(limit);
        resolve();
      };
      // Whatever the frames do, the game goes on.
      const limit = window.setTimeout(() => {
        this.flight = undefined;
        resolve();
      }, BALL_SECONDS * 3000);
      this.flight = { from, to, height, done: finish, age: 0 };
    });
  }

  private hand(character: Player): THREE.Vector3 {
    return character.position.clone().setY(character.position.y + 1);
  }

  private async rule(icon: string, label: string, text: string): Promise<void> {
    this.ctx.enterPanel('home');
    this.ctx.say(text);
    await this.home.sheet.press([{ icon, label }], 0);
  }

  private async basketball(): Promise<void> {
    const { ctx, building } = this;
    if (building === undefined) return;
    await this.rule('🏀', 'Começar', phrases.basketRule);
    ctx.avatar.placeAt(building.yardSpot('shoot'), FACE_NORTH);
    const calm = ctx.settings.reducedMotion;
    let misses = 0;
    for (let turn = 0; turn < TRIES; turn += 1) {
      const aim = await this.home.sheet.aim('🏀 Arremessar', calm ? CALM_AIM_SECONDS : AIM_SECONDS);
      ctx.avatar.playEmote('Throw');
      const hit = shotHits(aim, misses);
      const target = hit ? building.hoop : building.hoop.clone().setX(building.hoop.x + 1.1);
      await this.throwBall(this.hand(ctx.avatar), target, 2.2);
      if (hit) {
        ctx.sound('correct');
        ctx.avatar.playEmote('Yes');
        ctx.say(phrases.basketIn);
        await wait(STEP_MS);
        return;
      }
      misses += 1;
      ctx.say(phrases.basketNear);
      await wait(STEP_MS);
    }
  }

  private async soccer(): Promise<void> {
    const { ctx, building } = this;
    const friend = this.friends[0];
    if (building === undefined || friend === undefined) return;
    await this.rule('⚽', 'Começar', phrases.soccerRule);
    ctx.avatar.placeAt(building.yardSpot('kick'), FACE_NORTH);
    friend.placeAt(building.yardSpot('friend'), 1);
    for (let pass = 0; pass < 2; pass += 1) {
      friend.playEmote('Kick');
      await this.throwBall(this.hand(friend), ctx.avatar.position.clone(), 0.4);
      ctx.say(phrases.soccerPass);
      await this.home.sheet.press([{ icon: '⚽', label: 'Devolver' }], 0);
      ctx.avatar.playEmote('Kick');
      await this.throwBall(ctx.avatar.position.clone(), friend.position.clone(), 0.4);
    }
    friend.playEmote('Kick');
    await this.throwBall(this.hand(friend), ctx.avatar.position.clone(), 0.4);
    await this.home.sheet.press([{ icon: '🥅', label: 'Chutar ao gol' }], 0);
    ctx.avatar.playEmote('Kick');
    await this.throwBall(ctx.avatar.position.clone(), building.goal, 0.8);
    ctx.sound('correct');
    friend.playEmote('Yes');
    ctx.say(phrases.soccerGoal);
    await wait(STEP_MS);
  }

  /** Friends hide in plain sight and wave when found: there is nothing to fear here. */
  private async hideAndSeek(dayNumber: number): Promise<void> {
    const { ctx, building } = this;
    if (building === undefined) return;
    await this.rule('🙈', 'Procurar', phrases.hideRule);
    const spots = hidingPlaces(building.hideSpots, this.friends.length, dayNumber);
    this.friends.forEach((friend, index) => {
      const spot = spots[index];
      if (spot !== undefined) friend.placeAt(spot, 0);
    });
    this.seeking = [...this.friends];
    ctx.backToExploring();
    await new Promise<void>((resolve) => {
      const look = () => {
        const found = this.seeking.find(
          (friend) => friend.position.distanceTo(ctx.avatar.position) < FOUND_RANGE,
        );
        if (found !== undefined) {
          this.seeking = this.seeking.filter((friend) => friend !== found);
          found.playEmote('Wave');
          ctx.sound('correct');
          ctx.say(phrases.hideFound);
        }
        if (this.seeking.length === 0) resolve();
        else window.setTimeout(look, 250);
      };
      look();
    });
    await wait(STEP_MS);
  }

  private async hopscotch(): Promise<void> {
    const { ctx, building } = this;
    if (building === undefined) return;
    await this.rule('🔢', 'Começar', phrases.hopRule);
    for (let square = 1; square <= HOPSCOTCH_SQUARES; square += 1) {
      await this.home.sheet.press([{ icon: String(square), label: 'Pular' }], 0);
      ctx.avatar.placeAt(building.hopSquare(square), FACE_NORTH);
      if (ctx.avatar.isGrounded) ctx.avatar.jump();
      ctx.sound('tap');
      ctx.say(phrases.hopNumber(square));
      await wait(500);
    }
    ctx.avatar.playEmote('Dance');
    await wait(STEP_MS);
  }

  private async catchBall(): Promise<void> {
    const { ctx, building } = this;
    const friend = this.friends[1];
    if (building === undefined || friend === undefined) return;
    await this.rule('🤾', 'Começar', phrases.catchRule);
    ctx.avatar.placeAt(building.yardSpot('catch'), FACE_NORTH);
    friend.placeAt(building.yardSpot('catch').setZ(building.yardSpot('catch').z - 4), 0);
    for (let turn = 0; turn < CATCHES; turn += 1) {
      friend.playEmote('Throw');
      await this.throwBall(this.hand(friend), this.hand(ctx.avatar), 1.4);
      ctx.avatar.playEmote('Pick');
      ctx.say(phrases.catchGot);
      await this.home.sheet.press([{ icon: '🤾', label: 'Jogar de volta' }], 0);
      ctx.avatar.playEmote('Throw');
      await this.throwBall(this.hand(ctx.avatar), this.hand(friend), 1.4);
    }
  }

  private async rope(): Promise<void> {
    const { ctx } = this;
    await this.rule('🪢', 'Começar', phrases.ropeRule);
    for (let jump = 1; jump <= ROPE_JUMPS; jump += 1) {
      await this.home.sheet.press([{ icon: String(jump), label: 'Pular' }], 0);
      if (ctx.avatar.isGrounded) ctx.avatar.jump();
      ctx.sound('tap');
      await wait(600);
    }
  }

  /** The playground is shared: first the friend, then the child. */
  private async turnOn(emote: 'Sit', done: string): Promise<void> {
    const { ctx } = this;
    const friend = this.friends[2];
    ctx.enterPanel('home');
    ctx.say(phrases.waitTurn);
    friend?.placeAt(ctx.avatar.position.clone().setX(ctx.avatar.position.x + 1.4), FACE_NORTH);
    friend?.playEmote('Yes');
    await wait(TURN_MS);
    ctx.say(phrases.yourTurnNow);
    await this.home.sheet.press([{ icon: '🛝', label: 'Brincar' }], 0);
    if (ctx.avatar.canDo(emote)) ctx.avatar.playEmote(emote);
    await wait(TURN_MS);
    ctx.avatar.release();
    ctx.say(done);
    await wait(STEP_MS);
  }
}
