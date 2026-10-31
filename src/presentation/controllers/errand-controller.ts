import { phrases } from '@application/phrases';
import {
  allPicked,
  billOf,
  isBakeryRun,
  isOnList,
  nextToPick,
  pay,
  pick,
  priceOf,
  advance,
  type Errand,
} from '@domain/errand/errand';
import { groceries, groceryOf, recipeOf, type GroceryId } from '@domain/errand/groceries';
import { randomInt, shuffled } from '@domain/shared/random';
import { spoken, total, type Cents } from '@domain/money/money';
import type { GameContext } from '@presentation/game-context';
import type { HomeController } from '@presentation/controllers/home-controller';
import type { Player } from '@presentation/actors/player';
import { PayPanel, type BillLine } from '@presentation/ui/pay-panel';
import { CityPlace } from '@presentation/world/city';
import type { MarketInterior } from '@presentation/world/market-interior';
import { itemOfPlace, ITEM_PLACE, MarketPlace } from '@presentation/world/market-position';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const SHELF_SIZE = 8;
const FRIDGE_LOOK_MS = 2600;
const STEP_MS = 1200;
const STANDING = { x: 0, z: 0 };

/** The lunch task, from the fridge to the table: every stage is saved as it ends. */
export class ErrandController {
  readonly panel = new PayPanel();
  private cashier: Player | undefined;
  private market: MarketInterior | undefined;

  constructor(
    private readonly ctx: GameContext,
    private readonly home: HomeController,
  ) {}

  private get errand(): Errand | undefined {
    return this.home.errand;
  }

  private get shopping(): boolean {
    return this.ctx.world.inside === this.market && this.market !== undefined;
  }

  /** What the arrow shows, outside the house. */
  get goalPlaceId(): string | undefined {
    const { errand } = this;
    if (errand === undefined) return undefined;
    if (this.shopping) {
      if (errand.stage !== 'shop') return MarketPlace.door;
      const next = nextToPick(errand);
      return next === undefined ? MarketPlace.checkout : `${ITEM_PLACE}${next}`;
    }
    if (errand.stage === 'bring') return CityPlace.home;
    if (errand.stage !== 'shop') return undefined;
    return isBakeryRun(errand) ? CityPlace.bakery : CityPlace.market;
  }

  get tip(): string | undefined {
    const { errand } = this;
    if (errand === undefined) return undefined;
    switch (errand.stage) {
      case 'ask':
        return undefined;
      case 'shop':
        if (this.shopping) {
          const next = nextToPick(errand);
          return next === undefined ? phrases.goToCashier : phrases.findItem(groceryOf(next).name);
        }
        return isBakeryRun(errand) ? phrases.goToBakery : phrases.goToMarket;
      case 'bring':
        return this.ctx.world.indoors ? phrases.toTheKitchen : phrases.goHomeWithBags;
      case 'cook':
        return phrases.goToStove;
    }
  }

  /** The adult looks in the fridge, finds what is missing and makes the list. */
  async ask(): Promise<void> {
    await this.home.scene('fridge', async () => {
      const { house } = this.ctx.world;
      const level = await this.ctx.player.planSession.moneyLevel();
      const errand = await this.ctx.player.followDay.startErrand(level);
      this.home.setDay(await this.ctx.player.followDay.load());
      const recipe = recipeOf(errand.recipe);
      const has = recipe.needs.filter((id) => !errand.list.includes(id));
      this.ctx.guardianStandsAt('fridge');
      house.openFridge(
        has.map((id) => groceryOf(id).icon),
        errand.list.length,
      );
      this.ctx.say(phrases.lunchIdea(recipe.name));
      await wait(FRIDGE_LOOK_MS);
      const names = errand.list.map((id) => groceryOf(id).name).join(' e ');
      this.ctx.say(phrases.somethingMissing(names));
      await this.home.sheet.press(
        [
          ...errand.list.map((id) => ({ icon: groceryOf(id).icon, label: groceryOf(id).short })),
          { icon: '📝', label: 'Pegar a lista' },
        ],
        errand.list.length,
      );
      this.ctx.say(phrases.takeMoney(spoken(total(errand.wallet))));
      this.ctx.guardian?.playEmote('Wave');
      await wait(STEP_MS);
      house.closeFridge();
      await this.save(advance(errand));
      this.ctx.guardianStandsAt('kitchen');
      return this.tip;
    });
  }

  /** Into the walkable market, with today's shelves. */
  async enterMarket(): Promise<void> {
    const { errand } = this;
    if (errand === undefined) return;
    this.ctx.enterPanel('home');
    const market = await this.ctx.whileLoading(this.ctx.town.prepareMarket());
    this.market = market;
    this.cashier ??= this.ctx.addPerson('cashier');
    const cashier = this.cashier;
    await this.ctx.transition(() => {
      const others = shuffled(
        Math.random,
        groceries.filter((item) => !isOnList(errand, item.id) && item.id !== 'bread'),
      ).slice(0, SHELF_SIZE - errand.list.length);
      const shelf = shuffled(Math.random, [...errand.list.map(groceryOf), ...others]);
      market.stockForErrand(
        shelf.map((item) => ({ ...item, price: priceOf(item.id, errand.level) })),
        errand.picked,
      );
      cashier.placeAt(market.cashierSpot, -Math.PI / 2);
      this.ctx.enterSpace(market);
    });
    this.ctx.backToExploring(this.tip);
    this.ctx.refreshGoal();
  }

  /** Every frame while shopping: the cart comes along. */
  update(dt: number): void {
    if (!this.shopping) return;
    this.market?.followWithCart(this.ctx.avatar.position, this.ctx.avatar.facing, dt);
    this.cashier?.update(dt, STANDING, false, this.ctx.world);
  }

  /** The action button, inside the market. Answers false for what is not of the task. */
  async useInMarket(placeId: string): Promise<boolean> {
    const { errand, market } = this;
    if (market === undefined || !this.shopping) return false;
    const item = itemOfPlace(placeId);
    if (item !== undefined) {
      await this.take(item as GroceryId, errand, market);
      return true;
    }
    if (placeId === MarketPlace.checkout) {
      await this.checkout(market);
      return true;
    }
    if (placeId === MarketPlace.door) {
      await this.leaveMarket();
      return true;
    }
    return false;
  }

  private async take(
    item: GroceryId,
    errand: Errand | undefined,
    market: MarketInterior,
  ): Promise<void> {
    const { name } = groceryOf(item);
    if (errand?.stage !== 'shop' || !isOnList(errand, item)) {
      this.ctx.say(phrases.notOnList(name));
      return;
    }
    if (errand.picked.includes(item)) return;
    this.ctx.avatar.playEmote('Pick');
    market.takeFromShelf(item);
    this.ctx.sound('correct');
    await this.save(pick(errand, item));
    this.ctx.say(this.tip ?? phrases.goToCashier);
    this.ctx.refreshGoal();
  }

  private billLines(errand: Errand): BillLine[] {
    return errand.list.map((id) => ({
      icon: groceryOf(id).icon,
      name: groceryOf(id).short,
      price: priceOf(id, errand.level),
    }));
  }

  private async checkout(market: MarketInterior): Promise<void> {
    const { errand } = this;
    if (errand?.stage !== 'shop') {
      this.ctx.say(phrases.nothingToPay);
      return;
    }
    if (!allPicked(errand)) {
      this.ctx.say(this.tip ?? phrases.goToCashier);
      return;
    }
    this.ctx.enterPanel('home');
    this.ctx.avatar.placeAt(market.checkoutSpot, Math.PI / 2);
    const view = market.checkoutCamera;
    this.ctx.rig.setFocus(view.position, view.lookAt);
    await this.payFor(errand);
    this.cashier?.playEmote('Wave');
    this.ctx.rig.clearFocus();
    this.ctx.backToExploring(this.tip);
    this.ctx.refreshGoal();
  }

  /** The same at the market and at the bakery: pay, then check what came back. */
  private async payFor(errand: Errand): Promise<void> {
    const bill = billOf(errand);
    this.ctx.say(phrases.toPay(spoken(bill)));
    const paid = await this.panel.pay(this.billLines(errand), errand.wallet);
    const given = total(paid);
    const change = given - bill;
    if (change > 0) {
      this.ctx.say(phrases.changeComing);
      await this.panel.checkChange(
        given,
        bill,
        this.changeOptions(change),
        errand.level !== 'cents',
        () => {
          this.ctx.sound('hint');
          this.ctx.say(phrases.changeWas(spoken(change)));
        },
      );
    }
    this.ctx.sound('coin');
    await this.save(pay(errand, paid));
    this.ctx.say(phrases.thanksCashier);
  }

  private changeOptions(change: Cents): readonly Cents[] {
    const step = change % 100 === 0 ? 100 : 50;
    const near = [change + step, Math.max(step, change - step)].filter((v) => v !== change);
    const extra = change + step * randomInt(Math.random, 2, 3);
    return shuffled(Math.random, [...new Set([change, ...near, extra])].slice(0, 3));
  }

  private async leaveMarket(): Promise<void> {
    const { errand } = this;
    if (errand?.stage === 'shop' && errand.picked.length > 0) {
      this.ctx.say(phrases.payFirst);
      return;
    }
    this.ctx.enterPanel('home');
    await this.ctx.transition(() => {
      this.ctx.leaveSpace(CityPlace.market);
    });
    this.ctx.backToExploring(this.tip);
    this.ctx.refreshGoal();
  }

  /** At the bakery the child asks with cards, as in any AAC talk, and then pays. */
  async orderAtBakery(): Promise<void> {
    const { errand } = this;
    if (errand === undefined) return;
    this.ctx.enterPanel('home');
    this.ctx.say(phrases.askWithCards);
    await this.home.sheet.choose(phrases.askWithCards, [
      { id: 'want', icon: '🙋', label: 'Eu quero' },
    ]);
    const wanted = groceryOf('bread');
    for (;;) {
      const chosen = await this.home.sheet.choose(phrases.askWhat, [
        { id: 'bread', icon: wanted.icon, label: wanted.short },
        { id: 'cake', icon: '🍰', label: 'Bolo' },
        { id: 'cookie', icon: '🍪', label: 'Biscoito' },
      ]);
      if (chosen === 'bread') break;
      const other = chosen === 'cake' ? phrases.cake : phrases.cookie;
      this.ctx.say(phrases.notOnList(other));
    }
    this.ctx.say(phrases.bakeryOrder(wanted.short.toLowerCase()));
    await wait(STEP_MS);
    await this.payFor(pick(errand, 'bread'));
    this.ctx.backToExploring(this.tip);
    this.ctx.refreshGoal();
  }

  /** The bags go in the kitchen and the change goes back to the adult. */
  async deliver(): Promise<void> {
    const { errand } = this;
    if (errand === undefined) return;
    await this.home.scene('fridge', async () => {
      const { avatar, world } = this.ctx;
      this.ctx.guardianStandsAt('fridge');
      const have = recipeOf(errand.recipe).needs.map((id) => groceryOf(id).icon);
      world.house.openFridge(have, 0);
      this.ctx.say(phrases.putAway);
      await this.home.sheet.press([{ icon: '🧺', label: 'Guardar as compras' }], 0);
      avatar.playEmote('Pick');
      await wait(STEP_MS);
      world.house.closeFridge();
      if (errand.change > 0) {
        this.ctx.say(phrases.giveChange(spoken(errand.change)));
        await this.home.sheet.press([{ icon: '👛', label: 'Entregar o troco' }], 0);
      }
      this.ctx.guardian?.playEmote('Wave');
      avatar.feel('happy');
      this.ctx.say(phrases.thanksForShopping);
      await wait(STEP_MS * 2);
      avatar.feel('calm');
      await this.save({ ...advance(errand), wallet: [], change: 0 });
      this.ctx.guardianStandsAt('kitchen');
      return this.tip;
    });
  }

  /** Together at the stove. The knife stays with the adult, always. */
  async cook(): Promise<void> {
    const { errand } = this;
    if (errand === undefined) return;
    const recipe = recipeOf(errand.recipe);
    await this.home.scene('stove', async () => {
      const { avatar, world } = this.ctx;
      this.ctx.guardianStandsAt('stove');
      const steps = [
        { icon: '🧼', label: 'Lavar' },
        { icon: '🔪', label: 'Adulto corta' },
        { icon: '🥄', label: 'Mexer' },
        { icon: '🍽️', label: 'Servir' },
      ];
      this.ctx.say(phrases.cookWash);
      await this.home.sheet.press(steps, 0);
      avatar.playEmote('Wash');
      await wait(STEP_MS);
      this.ctx.say(phrases.cookCut);
      await this.home.sheet.press(steps, 1);
      this.ctx.guardian?.playEmote('Pick');
      await wait(STEP_MS);
      this.ctx.say(phrases.cookStir);
      await this.home.sheet.press(steps, 2);
      world.house.setCooking(recipe.icon);
      avatar.playEmote('Pick');
      await wait(STEP_MS);
      this.ctx.say(phrases.cookServe);
      await this.home.sheet.press(steps, 3);
      world.house.setCooking(undefined);
      world.house.serveDish(recipe.icon);
      return undefined;
    });
    await this.home.eatLunch(recipe.icon);
  }

  private async save(errand: Errand): Promise<void> {
    await this.ctx.player.followDay.saveErrand(errand);
    this.home.setDay(await this.ctx.player.followDay.load());
  }

  close(): void {
    this.panel.close();
  }
}
