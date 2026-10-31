import { phrases } from '@application/phrases';
import {
  animalOf,
  foodOptions,
  isAnimal,
  OUTING_WALLET,
  TICKET_PRICE,
  zooChallenge,
  type Animal,
  type ZooChallenge,
} from '@domain/zoo/animals';
import { total, spoken, type Cents } from '@domain/money/money';
import type { HomeController } from '@presentation/controllers/home-controller';
import type { GameContext } from '@presentation/game-context';
import { CityPlace } from '@presentation/world/city';
import { standingGround } from '@presentation/world/neighbors';
import type { ZooPark } from '@presentation/world/zoo-park';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const STEP_MS = 1800;
/** The adult stays this close. */
const WITH_CHILD = 2.2;

const rules = [
  { icon: '🤫', label: 'Falar baixo' },
  { icon: '✋', label: 'Não bater na cerca' },
  { icon: '🧑', label: 'Ficar com o adulto' },
];

/** A day out: bus, ticket, and animals to get to know, with an adult always close. */
export class ZooController {
  private park: ZooPark | undefined;

  constructor(
    private readonly ctx: GameContext,
    private readonly home: HomeController,
  ) {}

  private get here(): boolean {
    return this.park !== undefined && this.ctx.world.inside === this.park;
  }

  /** At the bus stop, in the free part of the day. */
  async offerTrip(): Promise<boolean> {
    if (this.home.step !== 'outside') return false;
    this.ctx.enterPanel('home');
    this.ctx.say(phrases.zooOffer);
    const chosen = await this.home.sheet.choose(phrases.zooOffer, [
      { id: 'zoo', icon: '🦁', label: 'Zoológico' },
      { id: 'stay', icon: '🌳', label: 'Ficar aqui' },
    ]);
    if (chosen === 'stay') {
      this.ctx.backToExploring();
      return true;
    }
    await this.ctx.school.takeBus(() => this.arrive());
    return true;
  }

  private async arrive(): Promise<void> {
    const { ctx } = this;
    const park = await ctx.whileLoading(ctx.town.prepareZoo());
    this.park = park;
    await ctx.transition(() => {
      ctx.avatar.setPerch(0);
      ctx.avatar.release();
      ctx.rig.clearFocus();
      ctx.enterSpace(park);
      ctx.bringGuardian(park.entrance);
    });
    await this.buyTicket();
    ctx.say(phrases.zooRules);
    for (const [index] of rules.entries()) await this.home.sheet.press(rules, index);
    ctx.backToExploring(phrases.zooWalk);
  }

  private async buyTicket(): Promise<void> {
    const { ctx } = this;
    ctx.say(phrases.zooTicket(spoken(TICKET_PRICE)));
    const line = { icon: '🎟️', name: 'Ingresso', price: TICKET_PRICE };
    const { panel } = ctx.errand;
    const paid: readonly Cents[] = await panel.pay([line], OUTING_WALLET);
    const given = total(paid);
    const change = given - TICKET_PRICE;
    if (change <= 0) return;
    const options = [...new Set([change, change + 100, change + 200])];
    await panel.checkChange(given, TICKET_PRICE, options, true, () => {
      ctx.sound('hint');
      ctx.say(phrases.changeWas(spoken(change)));
    });
  }

  /** Every frame: the adult walks along. */
  update(dt: number): void {
    const { guardian, avatar } = this.ctx;
    if (!this.here || guardian === undefined) return;
    const dx = avatar.position.x - guardian.position.x;
    const dz = avatar.position.z - guardian.position.z;
    const distance = Math.hypot(dx, dz);
    const walk = distance > WITH_CHILD ? { x: dx / distance, z: dz / distance } : { x: 0, z: 0 };
    guardian.update(dt, walk, false, standingGround(this.ctx.world));
  }

  /** The action button in the zoo. False for anything else. */
  async use(placeId: string): Promise<boolean> {
    if (!this.here || !placeId.startsWith('zoo:')) return false;
    const id = placeId.slice('zoo:'.length);
    if (isAnimal(id)) await this.visit(animalOf(id));
    else if (id === 'snack') this.ctx.say(phrases.zooSnack);
    else if (id === 'toilet') this.ctx.say(phrases.zooToilet);
    else if (id === 'exit') await this.goHome();
    return true;
  }

  /** Coming close: its fact, then whatever the child wants to do with it. */
  private async visit(animal: Animal): Promise<void> {
    const { ctx, park } = this;
    if (park === undefined) return;
    ctx.enterPanel('home');
    const pen = park.actor(animal.id)?.group.getWorldPosition(ctx.avatar.position.clone());
    if (pen !== undefined) ctx.avatar.faceTowards(pen);
    const sticker = await ctx.player.meetAnimal.execute(animal.id);
    if (sticker !== undefined) ctx.sound('star');
    ctx.say(animal.fact);
    await wait(STEP_MS);
    for (;;) {
      const chosen = await this.home.sheet.choose(animal.name, [
        { id: 'hear', icon: '👂', label: 'Ouvir' },
        { id: 'feed', icon: animal.foodIcon, label: 'Dar comida' },
        { id: 'rest', icon: '😴', label: 'Ver dormir' },
        { id: 'ask', icon: '❓', label: 'Desafio' },
        { id: 'go', icon: '🚶', label: 'Seguir' },
      ]);
      if (chosen === 'go') break;
      if (chosen === 'hear') ctx.say(phrases.zooHear(animal.called, animal.sound));
      if (chosen === 'rest') await this.rest(animal);
      if (chosen === 'feed') await this.feed(animal);
      if (chosen === 'ask') await this.ask(zooChallenge(animal, Math.random));
      await wait(STEP_MS / 2);
    }
    ctx.backToExploring(phrases.zooWalk);
  }

  private async rest(animal: Animal): Promise<void> {
    const actor = this.park?.actor(animal.id);
    actor?.act('sleep');
    this.ctx.say(phrases.zooAsleep);
    await wait(STEP_MS * 2);
    actor?.act('idle');
  }

  /** With the keeper: the right food makes it eat, and the wrong one is simply left. */
  private async feed(animal: Animal): Promise<void> {
    const { ctx, park } = this;
    ctx.say(phrases.zooKeeper(animal.called));
    const chosen = await this.home.sheet.choose(
      phrases.zooKeeper(animal.called),
      foodOptions(animal, Math.random),
    );
    if (chosen !== animal.food) {
      ctx.say(phrases.zooNotFood(animal.called, animal.food));
      await wait(STEP_MS);
    }
    ctx.avatar.playEmote('Throw');
    const actor = park?.actor(animal.id);
    actor?.act('eat');
    ctx.say(phrases.zooEats(animal.called));
    await wait(STEP_MS * 1.5);
    actor?.act('idle');
  }

  private async ask(challenge: ZooChallenge): Promise<void> {
    const { ctx } = this;
    ctx.say(challenge.question);
    const chosen = await this.home.sheet.choose(challenge.question, challenge.options);
    ctx.sound(chosen === challenge.answerId ? 'correct' : 'hint');
    ctx.say(challenge.teach);
    await wait(STEP_MS);
  }

  private async goHome(): Promise<void> {
    const { ctx } = this;
    ctx.enterPanel('home');
    ctx.say(phrases.zooBye);
    await ctx.transition(() => {
      ctx.leaveSpace(CityPlace.busStop);
      ctx.guardianStandsAt('kitchen');
    });
    ctx.backToExploring();
  }
}
