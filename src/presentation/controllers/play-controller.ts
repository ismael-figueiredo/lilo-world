import type * as THREE from 'three';
import { phrases } from '@application/phrases';
import {
  ballArc,
  BOARD_SQUARES,
  boardAfter,
  CATCHES,
  dieRoll,
  hidingPlaces,
  HOPSCOTCH_SQUARES,
  inviteOf,
  peSport,
  ROPE_JUMPS,
  shotHits,
  TOWER_BLOCKS,
  TRIES,
} from '@domain/play/games';
import type { HomeController } from '@presentation/controllers/home-controller';
import type { Player } from '@presentation/actors/player';
import type { GameContext } from '@presentation/game-context';
import { CHAIR_TOP, type SchoolBuilding } from '@presentation/world/school-building';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const BALL_SECONDS = 0.9;
const STEP_MS = 1100;
const AIM_SECONDS = 1.1;
const CALM_AIM_SECONDS = 2;
const TURN_MS = 3000;
const FOUND_RANGE = 2.2;
const FACE_NORTH = Math.PI;
const FACE_SOUTH = 0;
const FACE_EAST = Math.PI / 2;
const BALL_REST = 0.3;
const DROP_SECONDS = 0.45;
const BOUNCE_SECONDS = 0.5;
const BOUNCE_HEIGHT = 0.6;
const SWING_PERIOD = 2.6;
const SWING_REACH = [0.18, 0.32, 0.5] as const;
const SEESAW_TILT = 0.2;
const SEESAW_PERIOD = 2.4;
const SLIDE_SECONDS = 1.8;
const CALM_RIDE = 0.5;
const PUSH_MS = 1900;

type Toy = 'swing' | 'slide' | 'seesaw';

interface Ride {
  readonly toy: Toy;
  readonly riders: readonly Player[];
  reach: number;
  age: number;
}

const friendNames = ['Ana', 'Teo', 'Ju'];

interface Flight {
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
  readonly height: number;
  readonly seconds: number;
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
  private ride: Ride | undefined;

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
      'play:swing': () => this.turnOn('swing', phrases.swingDone),
      'play:slide': () => this.turnOn('slide', phrases.slideDone),
      'play:seesaw': () => this.turnOn('seesaw', phrases.seesawDone),
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
    building?.turnRope(dt);
    if (flight !== undefined && building !== undefined) {
      flight.age += dt / flight.seconds;
      const { x, y, z } = ballArc(flight.from, flight.to, flight.height, flight.age);
      building.moveBall(x, y, z);
      if (flight.age >= 1) {
        this.flight = undefined;
        flight.done();
      }
    }
    if (this.ride !== undefined && building !== undefined) this.moveRide(this.ride, building, dt);
  }

  private moveRide(ride: Ride, building: SchoolBuilding, dt: number): void {
    ride.age += dt;
    const calm = this.ctx.settings.reducedMotion ? CALM_RIDE : 1;
    const seat = (who: Player | undefined, at: THREE.Vector3, facing: number): void => {
      if (who === undefined) return;
      const floor = who.position.y;
      who.placeAt(at.clone().setY(floor), facing);
      who.sitOn(at.y - floor);
    };
    if (ride.toy === 'swing') {
      const swing = Math.sin((ride.age / SWING_PERIOD) * Math.PI * 2) * ride.reach * calm;
      seat(ride.riders[0], building.swingTo(swing), FACE_SOUTH);
    } else if (ride.toy === 'seesaw') {
      const wave = Math.sin((ride.age / SEESAW_PERIOD) * Math.PI * 2);
      const [right, left] = building.tiltSeesaw(wave * SEESAW_TILT * calm);
      seat(ride.riders[0], right, -FACE_EAST);
      seat(ride.riders[1], left, FACE_EAST);
    } else {
      const along = Math.min(1, ride.age / SLIDE_SECONDS);
      seat(ride.riders[0], building.chuteAt(along * along), FACE_SOUTH);
    }
  }

  /** What the ball does after a shot: it falls, bounces and stays on the ground. */
  private async ballFalls(from: THREE.Vector3): Promise<void> {
    const ground = from.clone().setY(this.ctx.avatar.position.y + BALL_REST);
    await this.throwBall(from, ground, 0, DROP_SECONDS);
    await this.throwBall(ground, ground, BOUNCE_HEIGHT, BOUNCE_SECONDS);
  }

  private throwBall(
    from: THREE.Vector3,
    to: THREE.Vector3,
    height: number,
    seconds = BALL_SECONDS,
  ): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        window.clearTimeout(limit);
        resolve();
      };
      // Whatever the frames do, the game goes on.
      const limit = window.setTimeout(() => {
        this.flight = undefined;
        this.building?.moveBall(to.x, to.y, to.z);
        resolve();
      }, seconds * 3000);
      this.flight = { from, to, height, seconds, done: finish, age: 0 };
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
    ctx.avatar.faceTowards(building.hoop);
    const calm = ctx.settings.reducedMotion;
    let misses = 0;
    for (let turn = 0; turn < TRIES; turn += 1) {
      const aim = await this.home.sheet.aim('🏀 Arremessar', calm ? CALM_AIM_SECONDS : AIM_SECONDS);
      ctx.avatar.playEmote('Throw');
      const hit = shotHits(aim, misses);
      const target = hit ? building.hoop : building.hoop.clone().setX(building.hoop.x + 1.1);
      await this.throwBall(this.hand(ctx.avatar), target, 2.2);
      await this.ballFalls(target);
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
    await this.ballFalls(building.goal);
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
    // Found: everybody comes back to play.
    const near = ctx.avatar.position;
    this.friends.forEach((friend, index) => {
      friend.placeAt(near.clone().setX(near.x + 1.6 + index), 0);
    });
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
    this.building?.showRope(true);
    for (let jump = 1; jump <= ROPE_JUMPS; jump += 1) {
      await this.home.sheet.press([{ icon: String(jump), label: 'Pular' }], 0);
      if (ctx.avatar.isGrounded) ctx.avatar.jump();
      ctx.sound('tap');
      await wait(600);
    }
    this.building?.showRope(false);
  }

  /** The playground is shared: first the friends, then the child, on the toy itself. */
  private async turnOn(toy: Toy, done: string): Promise<void> {
    const { ctx, building } = this;
    if (building === undefined) return;
    const [, partner, friend] = this.friends;
    ctx.enterPanel('home');
    ctx.say(phrases.waitTurn);
    if (friend !== undefined) {
      this.takeTurn(toy, [friend, ...(partner === undefined ? [] : [partner])]);
      await wait(toy === 'slide' ? SLIDE_SECONDS * 1000 + 300 : TURN_MS);
    }
    this.endRide();
    ctx.say(phrases.yourTurnNow);
    await this.home.sheet.press([{ icon: '🛝', label: 'Brincar' }], 0);
    const back = ctx.avatar.position.clone();
    this.takeTurn(toy, [ctx.avatar, ...(friend === undefined ? [] : [friend])]);
    await this.ridePushed(toy);
    this.endRide();
    ctx.avatar.placeAt(back, FACE_NORTH);
    ctx.say(done);
    await wait(STEP_MS);
  }

  private takeTurn(toy: Toy, riders: readonly Player[]): void {
    const seated = riders.slice(0, toy === 'seesaw' ? 2 : 1);
    for (const rider of seated) {
      rider.release();
      if (rider.canDo('Sit')) rider.playEmote('Sit');
    }
    this.ride = { toy, riders: seated, reach: SWING_REACH[0], age: 0 };
  }

  /** The child gives the push: each press swings higher. */
  private async ridePushed(toy: Toy): Promise<void> {
    const { ride, ctx } = this;
    if (ride === undefined) return;
    if (toy === 'slide') {
      await wait(SLIDE_SECONDS * 1000 + 300);
      return;
    }
    ctx.say(toy === 'swing' ? phrases.swingPush : phrases.seesawPush);
    for (const reach of SWING_REACH) {
      await this.home.sheet.press([{ icon: '👆', label: 'Empurrar' }], 0);
      ctx.sound('tap');
      ride.reach = reach;
      await wait(PUSH_MS);
    }
  }

  /** Everybody gets off: the swing stops and whoever was riding stands beside the toy. */
  private endRide(): void {
    const { ride, building, ctx } = this;
    if (ride === undefined || building === undefined) return;
    this.ride = undefined;
    building.swingTo(0);
    building.tiltSeesaw(0);
    ride.riders.forEach((rider, index) => {
      rider.release();
      rider.setPerch(0);
      if (rider === ctx.avatar) return;
      const spot = ctx.avatar.position;
      rider.placeAt(spot.clone().setX(spot.x + 1.4 + index), FACE_NORTH);
    });
  }

  /** The way to the library: warming up on its free floor. */
  async warmUpInside(building: SchoolBuilding, friends: readonly Player[]): Promise<void> {
    this.building = building;
    this.friends = friends;
    this.played = false;
    this.ctx.enterPanel('home');
    await this.ctx.transition(() => {
      this.ctx.avatar.setPerch(0);
      this.ctx.avatar.release();
      this.ctx.avatar.placeAt(building.warmUpSpot, FACE_NORTH);
      this.ctx.rig.snapTo(this.ctx.avatar.position);
    });
  }

  /** Rainy days: at the table in the library, with a friend, a board or a tower of blocks. */
  async playInside(
    building: SchoolBuilding,
    friends: readonly Player[],
    dayNumber: number,
  ): Promise<void> {
    const { ctx } = this;
    this.building = building;
    this.friends = friends;
    const friend = friends[0];
    ctx.enterPanel('home');
    await ctx.transition(() => {
      this.sitAtTable(ctx.avatar, building.gameSeat, FACE_NORTH);
      if (friend !== undefined) {
        friend.root.visible = true;
        this.sitAtTable(friend, building.gameFriendSeat, FACE_SOUTH);
      }
      building.movePiece('child', 0);
      building.movePiece('friend', 0);
      building.stackBlocks(0);
      const view = building.gameCamera;
      ctx.rig.setFocus(view.position, view.lookAt, true);
    });
    ctx.say(phrases.chooseInside);
    const chosen = await this.home.sheet.choose(phrases.chooseInside, [
      { id: 'board', icon: '🎲', label: 'Tabuleiro' },
      { id: 'tower', icon: '🧱', label: 'Torre de blocos' },
    ]);
    if (chosen === 'tower') await this.tower(building);
    else await this.board(building, dayNumber);
    this.played = true;
    ctx.rig.clearFocus();
    ctx.rig.snapTo(building.warmUpSpot);
    ctx.avatar.setPerch(0);
    ctx.avatar.release();
    ctx.avatar.placeAt(building.warmUpSpot, FACE_NORTH);
    if (friend !== undefined) {
      friend.setPerch(0);
      friend.release();
      friend.placeAt(building.warmUpSpot.setX(building.warmUpSpot.x + 1.4), FACE_NORTH);
    }
    ctx.avatar.playEmote('Dance');
    ctx.say(phrases.gameDone);
    await wait(STEP_MS * 2);
  }

  private sitAtTable(who: Player, at: THREE.Vector3, facing: number): void {
    who.sitOn(CHAIR_TOP);
    who.release();
    who.placeAt(at, facing);
    if (who.canDo('Sit')) who.playEmote('Sit');
  }

  /** Both pieces go all the way: the game ends when the child's reaches the last square. */
  private async board(building: SchoolBuilding, dayNumber: number): Promise<void> {
    const { ctx } = this;
    ctx.say(phrases.boardRule);
    let mine = 0;
    let theirs = 0;
    for (let turn = 0; mine < BOARD_SQUARES - 1; turn += 2) {
      await this.home.sheet.press([{ icon: '🎲', label: 'Jogar o dado' }], 0);
      const roll = dieRoll(turn, dayNumber);
      ctx.sound('tap');
      ctx.say(phrases.boardRolled(roll));
      mine = boardAfter(mine, roll);
      building.movePiece('child', mine);
      await wait(STEP_MS);
      if (mine >= BOARD_SQUARES - 1) break;
      ctx.say(phrases.boardFriend);
      await wait(STEP_MS);
      theirs = boardAfter(theirs, dieRoll(turn + 1, dayNumber));
      building.movePiece('friend', theirs);
      await wait(STEP_MS);
    }
    ctx.sound('correct');
    ctx.say(phrases.boardDone);
    await wait(STEP_MS);
  }

  private async tower(building: SchoolBuilding): Promise<void> {
    const { ctx } = this;
    ctx.say(phrases.towerRule);
    for (let block = 1; block <= TOWER_BLOCKS; block += 1) {
      await this.home.sheet.press([{ icon: String(block), label: 'Colocar bloco' }], 0);
      building.stackBlocks(block);
      ctx.sound('tap');
    }
    ctx.sound('correct');
    ctx.say(phrases.towerDone);
    await wait(STEP_MS);
  }
}
