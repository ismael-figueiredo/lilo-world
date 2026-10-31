import { phrases } from '@application/phrases';
import {
  BEACH_WALLET,
  CASTLE_TOWERS,
  isBeachDay,
  isPacked,
  KIOSK_PRICE,
  mayEnterWater,
  packItems,
  seaFlag,
  shellLooks,
  shellRound,
  type PackItem,
} from '@domain/beach/beach';
import type { OutfitId } from '@domain/avatar/child';
import { CityPlace } from '@presentation/world/city';
import type { BillLine } from '@presentation/ui/pay-panel';
import { spoken, total, type Cents } from '@domain/money/money';
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
import type { HomeController } from '@presentation/controllers/home-controller';
import type { GameContext } from '@presentation/game-context';
import type { BeachPark } from '@presentation/world/beach-park';
import { standingGround } from '@presentation/world/neighbors';
import type { ZooPark } from '@presentation/world/zoo-park';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const STEP_MS = 1800;
/** The adult stays this close, at the zoo and at the beach. */
const WITH_CHILD = 2.2;
const BALL_TURNS = 4;
const STAND_FACING = Math.PI;

const rules = [
  { icon: '🤫', label: 'Falar baixo' },
  { icon: '✋', label: 'Não bater na cerca' },
  { icon: '🧑', label: 'Ficar com o adulto' },
];

/** Days out, from the bus stop: the same adult, the same money and a place to walk. */
export class Outings {
  private zoo: ZooPark | undefined;
  private beach: BeachPark | undefined;
  /** The swimsuit is for the beach: the child's own clothes come back after it. */
  private wornBefore: OutfitId = 'home';

  constructor(
    private readonly ctx: GameContext,
    private readonly home: HomeController,
  ) {}

  private get here(): boolean {
    const { inside } = this.ctx.world;
    return inside !== undefined && (inside === this.zoo || inside === this.beach);
  }

  /** At the bus stop, in the free part of the day. */
  async offerTrip(): Promise<boolean> {
    if (this.home.step !== 'outside') return false;
    this.ctx.enterPanel('home');
    this.ctx.say(phrases.tripOffer);
    const chosen = await this.home.sheet.choose(phrases.tripOffer, [
      { id: 'zoo', icon: '🦁', label: 'Zoológico' },
      { id: 'beach', icon: '🏖️', label: 'Praia' },
      { id: 'stay', icon: '🌳', label: 'Ficar aqui' },
    ]);
    if (chosen === 'zoo') await this.ctx.school.takeBus(() => this.arriveAtZoo());
    else if (chosen === 'beach') await this.goToBeach();
    else this.ctx.backToExploring();
    return true;
  }

  /** The adult walks along. */
  update(dt: number): void {
    const { guardian, avatar } = this.ctx;
    if (!this.here || guardian === undefined) return;
    const dx = avatar.position.x - guardian.position.x;
    const dz = avatar.position.z - guardian.position.z;
    const distance = Math.hypot(dx, dz);
    const walk = distance > WITH_CHILD ? { x: dx / distance, z: dz / distance } : { x: 0, z: 0 };
    guardian.update(dt, walk, false, standingGround(this.ctx.world));
  }

  /** The action button on a day out. False for anything else. */
  async use(placeId: string): Promise<boolean> {
    if (!this.here) return false;
    if (placeId.startsWith('zoo:')) {
      await this.useAtZoo(placeId.slice('zoo:'.length));
      return true;
    }
    if (placeId.startsWith('beach:')) {
      await this.useAtBeach(placeId.slice('beach:'.length));
      return true;
    }
    return false;
  }

  /** Paying is the same anywhere: money on the counter, then checking what came back. */
  private async payAt(line: BillLine, wallet: readonly Cents[]): Promise<void> {
    const { ctx } = this;
    const { panel } = ctx.errand;
    const paid = await panel.pay([line], wallet);
    const given = total(paid);
    const change = given - line.price;
    if (change <= 0) return;
    const options = [...new Set([change, change + 100, change + 200])];
    await panel.checkChange(given, line.price, options, true, () => {
      ctx.sound('hint');
      ctx.say(phrases.changeWas(spoken(change)));
    });
  }

  private async leave(): Promise<void> {
    const { ctx } = this;
    ctx.enterPanel('home');
    ctx.say(phrases.tripBye);
    await ctx.transition(() => {
      ctx.leaveSpace(CityPlace.busStop);
      ctx.guardianStandsAt('kitchen');
    });
    ctx.backToExploring();
  }

  // ---------- The zoo ----------

  private async arriveAtZoo(): Promise<void> {
    const { ctx } = this;
    const park = await ctx.whileLoading(ctx.town.prepareZoo());
    this.zoo = park;
    await ctx.transition(() => {
      ctx.avatar.setPerch(0);
      ctx.avatar.release();
      ctx.rig.clearFocus();
      ctx.enterSpace(park);
      ctx.bringGuardian(park.entrance);
    });
    ctx.say(phrases.zooTicket(spoken(TICKET_PRICE)));
    await this.payAt({ icon: '🎟️', name: 'Ingresso', price: TICKET_PRICE }, OUTING_WALLET);
    ctx.say(phrases.zooRules);
    for (const [index] of rules.entries()) await this.home.sheet.press(rules, index);
    ctx.backToExploring(phrases.zooWalk);
  }

  private async useAtZoo(id: string): Promise<void> {
    if (isAnimal(id)) await this.visit(animalOf(id));
    else if (id === 'snack') this.ctx.say(phrases.zooSnack);
    else if (id === 'toilet') this.ctx.say(phrases.zooToilet);
    else if (id === 'exit') await this.leave();
  }

  /** Coming close: its fact, then whatever the child wants to do with it. */
  private async visit(animal: Animal): Promise<void> {
    const { ctx, zoo } = this;
    if (zoo === undefined) return;
    ctx.enterPanel('home');
    const pen = zoo.actor(animal.id)?.group.getWorldPosition(ctx.avatar.position.clone());
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
    const actor = this.zoo?.actor(animal.id);
    actor?.act('sleep');
    this.ctx.say(phrases.zooAsleep);
    await wait(STEP_MS * 2);
    actor?.act('idle');
  }

  /** With the keeper: the right food makes it eat, and the wrong one is simply left. */
  private async feed(animal: Animal): Promise<void> {
    const { ctx, zoo } = this;
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
    const actor = zoo?.actor(animal.id);
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

  // ---------- The beach ----------

  private async goToBeach(): Promise<void> {
    const { ctx } = this;
    if (!isBeachDay(ctx.weather)) {
      ctx.backToExploring(phrases.beachNotToday);
      return;
    }
    await this.pack();
    await ctx.school.takeBus(() => this.arriveAtBeach());
  }

  /** The bag: what the sun asks for. Coat and boots simply stay. */
  private async pack(): Promise<void> {
    const { ctx } = this;
    const packed: PackItem[] = [];
    ctx.say(phrases.beachPack);
    while (!isPacked(packed)) {
      const chosen = await this.home.sheet.choose(
        phrases.beachPack,
        packItems.map((item) => ({ ...item, used: packed.includes(item.id) })),
      );
      const item = packItems.find((option) => option.id === chosen);
      if (item === undefined) continue;
      if (item.id === 'coat' || item.id === 'boots') ctx.say(phrases.beachNoNeed(item.label));
      else {
        packed.push(item.id);
        ctx.sound('tap');
      }
    }
  }

  private async arriveAtBeach(): Promise<void> {
    const { ctx } = this;
    const park = await ctx.whileLoading(ctx.town.prepareBeach());
    this.beach = park;
    this.wornBefore = ctx.profile.outfit;
    await ctx.changeOutfit('swim');
    await ctx.transition(() => {
      ctx.avatar.setPerch(0);
      ctx.avatar.release();
      ctx.rig.clearFocus();
      ctx.enterSpace(park);
      ctx.bringGuardian(park.entrance);
      park.clearCastle();
      park.showFlag(seaFlag(ctx.weather));
    });
    ctx.backToExploring(phrases.beachHello);
  }

  private async useAtBeach(id: string): Promise<void> {
    const games: Readonly<Record<string, () => Promise<void>>> = {
      castle: () => this.castle(),
      ball: () => this.ball(),
      shells: () => this.shells(),
      water: () => this.water(),
      kiosk: () => this.kiosk(),
      exit: () => this.leaveBeach(),
    };
    await games[id]?.();
  }

  private async castle(): Promise<void> {
    const { ctx, beach } = this;
    if (beach === undefined) return;
    ctx.enterPanel('home');
    ctx.say(phrases.castleFill);
    for (let tower = 0; tower < CASTLE_TOWERS; tower += 1) {
      await this.home.sheet.press(
        [
          { icon: '🪣', label: 'Encher' },
          { icon: '🔄', label: 'Virar' },
        ],
        0,
      );
      ctx.avatar.playEmote('Pick');
      await wait(STEP_MS / 2);
      await this.home.sheet.press(
        [
          { icon: '🪣', label: 'Encher' },
          { icon: '🔄', label: 'Virar' },
        ],
        1,
      );
      beach.addTower(tower);
      ctx.sound('tap');
    }
    ctx.say(phrases.castleDecorate);
    const chosen = await this.home.sheet.choose(phrases.castleDecorate, [
      { id: 'pink', icon: '🐚', label: 'Conchas' },
      { id: 'red', icon: '🚩', label: 'Bandeiras' },
      { id: 'grey', icon: '🪨', label: 'Pedrinhas' },
    ]);
    beach.decorateCastle({ pink: 0xf08fb5, red: 0xe8504c, grey: 0x8a8f99 }[chosen] ?? 0xf08fb5);
    await ctx.player.keepBeachMemory.execute('castle');
    ctx.sound('star');
    ctx.avatar.feel('happy');
    ctx.say(phrases.castleDone);
    await wait(STEP_MS);
    ctx.avatar.feel('calm');
    ctx.backToExploring(phrases.beachMore);
  }

  /** The ball goes back and forth with the adult, one press at a time. */
  private async ball(): Promise<void> {
    const { ctx } = this;
    const { guardian } = ctx;
    ctx.enterPanel('home');
    ctx.say(phrases.ballRule);
    for (let turn = 0; turn < BALL_TURNS; turn += 1) {
      await this.home.sheet.press([{ icon: '🏐', label: 'Bater' }], 0);
      ctx.avatar.playEmote('Throw');
      await wait(STEP_MS / 2);
      guardian?.playEmote('Throw');
      await wait(STEP_MS / 2);
    }
    ctx.avatar.playEmote('Yes');
    ctx.say(phrases.gameDone);
    await wait(STEP_MS);
    ctx.backToExploring(phrases.beachMore);
  }

  /** Count what is really on the sand. */
  private async shells(): Promise<void> {
    const { ctx, beach } = this;
    if (beach === undefined) return;
    ctx.enterPanel('home');
    const round = shellRound(Math.random);
    beach.layShells(round.shells);
    const asked = phrases.shellsAsk(shellLooks[round.asked].name);
    ctx.say(asked);
    const chosen = await this.home.sheet.choose(
      asked,
      round.options.map((count) => ({ id: String(count), icon: '🐚', label: String(count) })),
    );
    const right = chosen === String(round.answer);
    ctx.sound(right ? 'correct' : 'hint');
    ctx.say(phrases.shellsWere(round.answer, shellLooks[round.asked].name));
    await wait(STEP_MS);
    ctx.backToExploring(phrases.beachMore);
  }

  /** The water, always with the adult and only to the buoys. The flag decides, not the child. */
  private async water(): Promise<void> {
    const { ctx, beach } = this;
    if (beach === undefined) return;
    ctx.enterPanel('home');
    const flag = seaFlag(ctx.weather);
    if (!mayEnterWater(flag)) {
      ctx.backToExploring(phrases.waterYellow);
      return;
    }
    ctx.say(phrases.waterGreen);
    await this.home.sheet.press([{ icon: '🧑', label: 'Ir com o adulto' }], 0);
    const back = ctx.avatar.position.clone();
    await ctx.transition(() => {
      ctx.avatar.placeAt(beach.shallow, STAND_FACING);
      ctx.bringGuardian(beach.shallow);
      if (ctx.avatar.canDo('Swim')) ctx.avatar.playEmote('Swim');
    });
    ctx.say(phrases.waterShallow);
    await this.home.sheet.press([{ icon: '🏖️', label: 'Voltar para a areia' }], 0);
    await ctx.transition(() => {
      ctx.avatar.release();
      ctx.avatar.placeAt(back, 0);
      ctx.bringGuardian(back);
    });
    ctx.backToExploring(phrases.beachMore);
  }

  private async kiosk(): Promise<void> {
    const { ctx } = this;
    ctx.enterPanel('home');
    ctx.say(phrases.askWithCards);
    await this.home.sheet.choose(phrases.askWithCards, [
      { id: 'want', icon: '🙋', label: 'Eu quero' },
    ]);
    const chosen = await this.home.sheet.choose(phrases.askWhat, [
      { id: 'água de coco', icon: '🥥', label: 'Água de coco' },
      { id: 'milho', icon: '🌽', label: 'Milho' },
      { id: 'picolé', icon: '🍦', label: 'Picolé' },
    ]);
    ctx.say(phrases.bakeryOrder(chosen));
    await wait(STEP_MS);
    ctx.say(phrases.toPay(spoken(KIOSK_PRICE)));
    await this.payAt({ icon: '🛍️', name: chosen, price: KIOSK_PRICE }, BEACH_WALLET);
    ctx.say(phrases.thanksCashier);
    await wait(STEP_MS);
    ctx.backToExploring(phrases.beachMore);
  }

  private async leaveBeach(): Promise<void> {
    await this.leave();
    await this.ctx.changeOutfit(this.wornBefore);
  }
}
