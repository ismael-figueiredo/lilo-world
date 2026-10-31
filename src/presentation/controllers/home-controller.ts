import type * as THREE from 'three';
import { outfitTips, phrases, stepTips, weatherTips } from '@application/phrases';
import {
  backpackList,
  currentBlock,
  currentStep,
  firstDay,
  notForToday,
  type DayState,
  type SchoolThing,
  type StepId,
} from '@domain/day/day-plan';
import { fitsWeather, phaseOf } from '@domain/day/weather';
import type { Errand } from '@domain/errand/errand';
import type { Station } from '@domain/curriculum/skill';
import type { GameContext } from '@presentation/game-context';
import { AgendaPanel } from '@presentation/ui/agenda-panel';
import { schoolThingLooks, stepLooks } from '@presentation/ui/day-looks';
import { studyLooks } from '@presentation/ui/study-looks';
import { skyLook } from '@presentation/world/sky-looks';
import { HomeSheet, type Picture } from '@presentation/ui/home-sheet';
import { placeOf, standSpots, type FoodId, type HouseThing } from '@presentation/world/house';
import { doorsOnTheWay, type HouseSpot } from '@presentation/world/house-plan';

/** What is used for each step. */
const stepThings: Readonly<Record<StepId, HouseThing>> = {
  wake: 'bed',
  eat: 'table',
  teeth: 'sink',
  dress: 'wardrobe',
  backpack: 'desk',
  lunch: 'fridge',
  study: 'desk',
  outside: 'door',
  shower: 'shower',
  pajamas: 'wardrobe',
  sleep: 'bed',
};

const foods: readonly { readonly id: FoodId; readonly icon: string; readonly label: string }[] = [
  { id: 'bread', icon: '🍞', label: 'Pão' },
  { id: 'fruit', icon: '🍎', label: 'Fruta' },
  { id: 'cereal', icon: '🥣', label: 'Cereal' },
  { id: 'egg', icon: '🍳', label: 'Ovo' },
];

const subjects: readonly Station[] = ['letters', 'numbers', 'world'];
const NOT_NOW = 'later';

const WALK_TIMEOUT_MS = 5000;
const REACHED = 0.12;
const CHAIR = { x: 3.8, z: 2.75, facing: 0 } as const;
const DESK_CHAIR = { x: -6.6, z: -1.45, facing: 0 } as const;
const IN_BED = { x: -6.2, z: -4.5, facing: 0 } as const;
const IN_SHOWER = { x: 6.6, z: -4.4, facing: 0 } as const;
const AT_MIRROR = { x: -3.8, z: -3.7, facing: Math.PI } as const;
const WINDOW = { x: -6.2, z: -5.9 } as const;
const WINDOW_LOOK_MS = 3200;
const CHAIR_HEIGHT = 0.2;
const BED_HEIGHT = 0.42;
/** A close look at the thing being used; the rest of the time the camera follows. */
const views: Readonly<
  Partial<Record<HouseThing, readonly [readonly number[], readonly number[]]>>
> = {
  bed: [
    [-4, 2.8, -1.9],
    [-6.2, 0.6, -4.4],
  ],
  table: [
    [3.8, 2.3, 7.2],
    [3.8, 0.9, 3],
  ],
  sink: [
    [2.6, 1.9, -1.4],
    [2.2, 1.15, -5.8],
  ],
  shower: [
    [6.4, 1.9, 0.6],
    [6.6, 1.2, -3.5],
  ],
  wardrobe: [
    [-3.2, 1.7, -0.6],
    [-2.5, 1.05, -5.8],
  ],
  desk: [
    [-6.4, 2.4, 2.4],
    [-6.6, 0.8, -1],
  ],
  fridge: [
    [7.3, 2.3, 5],
    [7, 1.15, 1],
  ],
  stove: [
    [2.6, 2.3, 4.6],
    [3.5, 1, 0.6],
  ],
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Life inside the house: the shining thing, the walk to it and what is done
 * there. Everything is in 3D, one step at a time, and any step can be done
 * again calmly; nothing here can go wrong.
 */
export class HomeController {
  readonly sheet = new HomeSheet();
  readonly agenda: AgendaPanel;
  private day: DayState = firstDay;
  private busy = false;
  private warnedDoor = false;
  private walking: { readonly to: THREE.Vector3; readonly arrive: () => void } | undefined;

  constructor(private readonly ctx: GameContext) {
    this.agenda = new AgendaPanel(() => {
      this.agenda.close();
      this.ctx.backToExploring();
    });
  }

  private get house() {
    return this.ctx.world.house;
  }

  /** The step the arrow and the lights point to. */
  get step(): StepId | undefined {
    return currentStep(this.day);
  }

  get goalPlaceId(): string | undefined {
    const thing = this.goalThing;
    return thing === undefined ? undefined : placeOf(thing);
  }

  /** What is lit now: lunch moves around the kitchen as its task goes on. */
  private get goalThing(): HouseThing | undefined {
    const { step } = this;
    if (step === undefined) return undefined;
    if (step !== 'lunch') return stepThings[step];
    const stage = this.errand?.stage;
    if (stage === 'shop') return 'door';
    return stage === 'cook' ? 'stove' : 'fridge';
  }

  get tip(): string | undefined {
    const { step } = this;
    if (step === 'lunch') return this.ctx.errand.tip ?? stepTips.lunch;
    return step === undefined ? undefined : stepTips[step];
  }

  get errand(): Errand | undefined {
    return this.day.errand;
  }

  /** The task saved something: what is lit follows it. */
  setDay(day: DayState): void {
    this.day = day;
    this.showGoal();
  }

  /** Where the child starts: in bed in a new morning, or back at home. */
  async begin(isNew: boolean, resumeAt: THREE.Vector3 | undefined): Promise<void> {
    this.day = await this.ctx.player.followDay.load();
    this.ctx.showDay(this.day);
    this.ctx.world.sky.setLook(skyLook(phaseOf(this.day), this.ctx.weather), true);
    this.warnedDoor = false;
    this.busy = false;
    this.house.clearTable();
    this.house.setCurtain(false);
    this.house.setWater(undefined);
    this.house.layOut([...backpackList(this.day), ...notForToday(this.day)]);
    if (this.step === 'wake') {
      await this.wake(isNew);
      return;
    }
    const start = resumeAt ?? this.house.world(standSpots.bed);
    this.ctx.avatar.placeAt(start, standSpots.bed.facing);
    this.showGoal();
  }

  /** Lights the current goal, from where the child is. */
  showGoal(): void {
    const { step } = this;
    const here = this.ctx.world.indoors;
    this.house.show(
      here && step !== undefined ? this.goalThing : undefined,
      this.ctx.avatar.position,
    );
  }

  openAgenda(): void {
    this.ctx.enterPanel('session');
    this.agenda.open(this.day, this.ctx.weather);
  }

  closeAgenda(): void {
    this.agenda.close();
  }

  /** Direction for the character while it walks by itself, once per frame. */
  steer(position: THREE.Vector3): { x: number; z: number } | undefined {
    if (this.walking === undefined) return undefined;
    const dx = this.walking.to.x - position.x;
    const dz = this.walking.to.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < REACHED) {
      this.walking.arrive();
      return undefined;
    }
    return { x: dx / distance, z: dz / distance };
  }

  /** The action button at one of the things of the house. */
  async use(thing: HouseThing): Promise<void> {
    if (this.busy) return;
    switch (thing) {
      case 'bed':
        if (this.isOpen('sleep')) await this.sleep();
        else this.ctx.say(phrases.bedNotYet);
        return;
      case 'table':
        if (this.isOpen('eat')) await this.eat();
        else this.ctx.say(this.tip ?? phrases.mealDone);
        return;
      case 'sink':
        await (this.isOpen('teeth') ? this.teeth() : this.washHands());
        return;
      case 'shower':
        if (this.isOpen('shower')) await this.shower();
        else this.ctx.say(this.tip ?? phrases.showerDone);
        return;
      case 'wardrobe':
        await this.wardrobe();
        return;
      case 'desk':
        if (this.isOpen('backpack')) await this.pack();
        else if (this.isOpen('study')) await this.study();
        else await this.practice();
        return;
      case 'door':
        await this.door();
        return;
      case 'fridge':
        await this.fridge();
        return;
      case 'stove':
        if (this.isOpen('lunch') && this.errand?.stage === 'cook') await this.ctx.errand.cook();
        else this.ctx.say(phrases.stoveNow);
        return;
    }
  }

  /** An adult jumps over the rest of this block of the day. */
  async skipBlock(): Promise<void> {
    await this.ctx.player.followDay.skipBlock();
    await this.begin(false, this.ctx.avatar.position.clone());
  }

  /** The child came back through the door of the house. */
  async comeHome(): Promise<void> {
    await this.ctx.goInside();
    this.ctx.avatar.placeAt(this.house.world(standSpots.door), Math.PI);
    // Shopping is part of lunch: going out to play is still to come.
    if (!this.isOpen('lunch')) await this.complete('outside');
    this.ctx.backToExploring(this.tip ?? phrases.backHome);
  }

  private isOpen(step: StepId): boolean {
    const block = currentBlock(this.day);
    return block?.steps.includes(step) === true && !this.day.done.includes(step);
  }

  /** Saves a step; a block that ends is a calm place to stop. */
  async complete(step: StepId): Promise<void> {
    const result = await this.ctx.player.followDay.complete(step);
    this.day = result.day;
    this.ctx.showDay(this.day);
    if (result.counted) this.ctx.sound('star');
    if (result.blockEnded) await this.ctx.stopPoint();
  }

  /** Runs a scene with the controls resting, and gives them back at the end. */
  async scene(thing: HouseThing, run: () => Promise<string | undefined>): Promise<void> {
    this.busy = true;
    this.ctx.enterPanel('home');
    this.house.show(undefined);
    await this.walkTo(standSpots[thing]);
    this.look(thing);
    const message = await run();
    await this.ctx.whileNotPaused();
    this.busy = false;
    this.ctx.backToExploring(this.tip ?? message);
    this.showGoal();
  }

  private look(thing: HouseThing): void {
    const view = views[thing];
    if (view === undefined) return;
    const [from, at] = view;
    const [fx = 0, fy = 0, fz = 0] = from;
    const [ax = 0, ay = 0, az = 0] = at;
    this.ctx.rig.setFocus(
      this.house.world({ x: fx, z: fz }).setY(fy),
      this.house.world({ x: ax, z: az }).setY(ay),
    );
  }

  /** Walks there through the doors, as the child would. */
  private async walkTo(spot: HouseSpot): Promise<void> {
    const here = this.house.local(this.ctx.avatar.position);
    for (const door of doorsOnTheWay(here, spot)) {
      await this.walkStraight({ ...door, facing: this.ctx.avatar.facing });
    }
    await this.walkStraight(spot);
  }

  private walkStraight(spot: HouseSpot): Promise<void> {
    const to = this.house.world(spot);
    return new Promise((resolve) => {
      const arrive = () => {
        window.clearTimeout(timer);
        this.walking = undefined;
        this.ctx.avatar.placeAt(to, spot.facing);
        resolve();
      };
      const timer = window.setTimeout(arrive, WALK_TIMEOUT_MS);
      this.walking = { to, arrive };
    });
  }

  private sitAt(spot: HouseSpot, height: number): void {
    const { avatar } = this.ctx;
    if (!avatar.canDo('Sit')) return;
    avatar.placeAt(this.house.world(spot), spot.facing);
    avatar.setPerch(height);
    avatar.playEmote('Sit');
  }

  private standUp(spot: HouseSpot): void {
    const { avatar } = this.ctx;
    avatar.setPerch(0);
    avatar.release();
    avatar.placeAt(this.house.world(spot), spot.facing);
  }

  /** A costume stays beside the bed: it was not made to lie down. */
  private goToBed(): void {
    const { avatar } = this.ctx;
    if (!avatar.canDo('Lie')) {
      avatar.placeAt(this.house.world(standSpots.bed), standSpots.bed.facing);
      return;
    }
    avatar.placeAt(this.house.world(IN_BED), IN_BED.facing);
    avatar.setPerch(BED_HEIGHT);
    avatar.playEmote('Lie');
    avatar.feel('asleep');
  }

  private async wake(isNew: boolean): Promise<void> {
    const { avatar } = this.ctx;
    this.busy = true;
    this.ctx.enterPanel('home');
    this.house.show(undefined);
    this.house.setMorningLight(true);
    this.goToBed();
    await this.ctx.changeOutfit('pajamas');
    this.look('bed');
    this.ctx.rig.snap();
    this.ctx.say(phrases.goodMorning(this.ctx.profile.name));
    await this.sheet.press([{ icon: '☀️', label: 'Levantar' }], 0);
    avatar.feel('happy');
    await this.ctx.transition(() => {
      this.standUp(standSpots.bed);
      avatar.feel('calm');
      this.house.setMorningLight(false);
    });
    await this.lookOutside();
    await this.complete('wake');
    this.busy = false;
    this.ctx.backToExploring(isNew ? phrases.firstWalk : this.tip);
    this.showGoal();
  }

  /** The window tells the weather before anybody has to say it. */
  private async lookOutside(): Promise<void> {
    this.ctx.avatar.faceTowards(this.house.world(WINDOW));
    this.ctx.rig.setFocus(
      this.house.world({ x: WINDOW.x + 0.4, z: WINDOW.z + 3.6 }).setY(1.5),
      this.house.world(WINDOW).setY(1.6),
    );
    this.ctx.say(weatherTips[this.ctx.weather]);
    await wait(WINDOW_LOOK_MS);
  }

  private async eat(): Promise<void> {
    await this.scene('table', async () => {
      const { avatar } = this.ctx;
      this.sitAt(CHAIR, CHAIR_HEIGHT);
      this.ctx.say(phrases.chooseFood);
      const chosen = await this.sheet.choose('O que você quer comer?', foods);
      const food = foods.find((option) => option.id === chosen) ?? foods[0];
      if (food === undefined) return undefined;
      this.house.serve(food.id);
      this.ctx.say(phrases.foodChosen(food.label));
      const bites: readonly Picture[] = [1, 2, 3].map(() => ({ icon: food.icon, label: 'Comer' }));
      for (let bite = 0; bite < bites.length; bite += 1) {
        await this.sheet.press(bites, bite);
        avatar.playEmote('SitEat');
        await wait(800);
        this.house.bite();
        await wait(700);
        avatar.playEmote('Sit');
      }
      avatar.feel('happy');
      this.ctx.say(phrases.mealDone);
      await wait(1400);
      avatar.feel('calm');
      this.house.clearTable();
      this.standUp(standSpots.table);
      await this.complete('eat');
      return phrases.mealDone;
    });
  }

  private async teeth(): Promise<void> {
    await this.scene('sink', async () => {
      const { avatar } = this.ctx;
      this.house.setMirror('bathroom');
      const steps: readonly Picture[] = [
        { icon: '🧴', label: 'Pôr a pasta' },
        { icon: '🪥', label: 'Escovar' },
        { icon: '💧', label: 'Enxaguar' },
      ];
      this.ctx.say(phrases.teethPaste);
      await this.sheet.press(steps, 0);
      avatar.playEmote('Pick');
      await wait(1000);
      this.ctx.say(phrases.teethBrush);
      await this.sheet.press(steps, 1);
      avatar.showFoam(true);
      avatar.playEmote('Brush');
      await wait(1300);
      avatar.playEmote('Brush');
      await wait(1300);
      this.ctx.say(phrases.teethRinse);
      await this.sheet.press(steps, 2);
      this.house.setWater('sink');
      avatar.playEmote('Wash');
      await wait(1000);
      avatar.showFoam(false);
      this.house.setWater(undefined);
      avatar.feel('happy');
      this.ctx.say(phrases.teethDone);
      await wait(1400);
      avatar.feel('calm');
      this.house.setMirror(undefined);
      await this.complete('teeth');
      return phrases.teethDone;
    });
  }

  private async washHands(): Promise<void> {
    await this.scene('sink', async () => {
      const { avatar } = this.ctx;
      const steps: readonly Picture[] = [
        { icon: '🧼', label: 'Sabonete' },
        { icon: '💧', label: 'Enxaguar' },
      ];
      this.ctx.say(phrases.handsSoap);
      await this.sheet.press(steps, 0);
      avatar.playEmote('Wash');
      await wait(1300);
      this.ctx.say(phrases.handsRinse);
      await this.sheet.press(steps, 1);
      this.house.setWater('sink');
      avatar.playEmote('Wash');
      await wait(1300);
      this.house.setWater(undefined);
      this.ctx.say(phrases.handsDone);
      await wait(800);
      return phrases.handsDone;
    });
  }

  /** The child goes behind an opaque curtain: only the water and the curtain are seen. */
  private async shower(): Promise<void> {
    await this.scene('shower', async () => {
      const { avatar } = this.ctx;
      const steps: readonly Picture[] = [
        { icon: '🚿', label: 'Abrir a água' },
        { icon: '🧼', label: 'Sabonete' },
        { icon: '💧', label: 'Enxaguar' },
      ];
      await this.walkTo(IN_SHOWER);
      this.house.setCurtain(true);
      avatar.root.visible = false;
      this.ctx.say(phrases.showerWater);
      await this.sheet.press(steps, 0);
      this.house.setWater('shower');
      await wait(1000);
      this.ctx.say(phrases.showerSoap);
      await this.sheet.press(steps, 1);
      await wait(1200);
      this.ctx.say(phrases.showerRinse);
      await this.sheet.press(steps, 2);
      await wait(1000);
      this.house.setWater(undefined);
      this.house.setCurtain(false);
      avatar.root.visible = true;
      await this.walkTo(standSpots.shower);
      this.ctx.say(phrases.showerDone);
      await wait(1200);
      await this.complete('shower');
      return phrases.showerDone;
    });
  }

  private async wardrobe(): Promise<void> {
    this.busy = true;
    this.ctx.enterPanel('home');
    this.house.show(undefined);
    await this.walkTo(AT_MIRROR);
    this.look('wardrobe');
    this.house.setMirror('bedroom');
    const night = this.isOpen('pajamas');
    await this.ctx.wardrobe.open(() => {
      void this.closeWardrobe();
    });
    this.ctx.say(night ? phrases.outfitForNight : phrases.outfitForDay);
  }

  private async closeWardrobe(): Promise<void> {
    this.house.setMirror(undefined);
    const { outfit, avatarId } = this.ctx.profile;
    const costume = avatarId !== 'child';
    const dressing = this.isOpen('dress') && (costume || outfit !== 'pajamas');
    if (this.isOpen('pajamas') && (costume || outfit === 'pajamas')) await this.complete('pajamas');
    else if (dressing) await this.complete('dress');
    this.busy = false;
    // A tip, never a block: the child keeps what they chose and can change it.
    const { weather } = this.ctx;
    const advice = dressing && !costume && !fitsWeather(weather, outfit);
    this.ctx.backToExploring(advice ? outfitTips[weather] : this.tip);
    this.showGoal();
  }

  private async pack(): Promise<void> {
    await this.scene('desk', async () => {
      const { avatar } = this.ctx;
      const needed = backpackList(this.day);
      const offered = [...needed, ...notForToday(this.day)];
      const packed = new Set<SchoolThing>();
      this.ctx.say(phrases.packList);
      while (packed.size < needed.length) {
        const chosen = await this.sheet.choose(
          `Mochila de hoje: ${needed.map((thing) => schoolThingLooks[thing].icon).join(' ')}`,
          offered.map((thing) => ({
            id: thing,
            ...{ icon: schoolThingLooks[thing].icon, label: schoolThingLooks[thing].name },
            used: packed.has(thing),
          })),
        );
        const thing = offered.find((option) => option === chosen);
        if (thing === undefined) continue;
        const { name } = schoolThingLooks[thing];
        if (!needed.includes(thing)) {
          this.ctx.say(phrases.notToday(name));
          continue;
        }
        packed.add(thing);
        this.house.takeFromDesk(thing);
        avatar.playEmote('Pick');
        this.ctx.say(phrases.packed(name));
        await wait(1000);
      }
      this.ctx.say(phrases.packDone);
      await wait(1000);
      await this.complete('backpack');
      return phrases.packDone;
    });
  }

  /** Sitting at the desk: the study happens in the room, with the answers on the side. */
  private async sitToStudy(): Promise<void> {
    this.busy = true;
    this.ctx.enterPanel('home');
    this.house.show(undefined);
    await this.walkTo(standSpots.desk);
    this.sitAt(DESK_CHAIR, CHAIR_HEIGHT);
    this.busy = false;
  }

  private getUp(): void {
    this.standUp(standSpots.desk);
    this.showGoal();
  }

  private async study(): Promise<void> {
    await this.sitToStudy();
    await this.ctx.session.start(
      () => {
        this.standUp(standSpots.desk);
        void this.studied();
      },
      () => {
        this.getUp();
      },
    );
  }

  /** The desk stays open: a child who likes studying can always study more. */
  private async practice(): Promise<void> {
    await this.sitToStudy();
    this.ctx.enterPanel('home');
    this.ctx.say(phrases.deskFree);
    const chosen = await this.sheet.choose(phrases.deskFree, [
      ...subjects.map((id) => ({ id, icon: studyLooks[id].icon, label: studyLooks[id].name })),
      { id: NOT_NOW, icon: '🚶', label: 'Agora não' },
    ]);
    const subject = subjects.find((id) => id === chosen);
    if (subject === undefined) {
      this.ctx.backToExploring(this.tip);
      this.getUp();
      return;
    }
    await this.ctx.practice(subject, () => {
      this.getUp();
    });
  }

  private async studied(): Promise<void> {
    await this.complete('study');
    this.ctx.say(this.tip ?? phrases.blockDone);
    this.showGoal();
  }

  private async fridge(): Promise<void> {
    if (!this.isOpen('lunch')) {
      this.ctx.say(phrases.fridgeNow);
      return;
    }
    const stage = this.errand?.stage;
    if (stage === undefined || stage === 'ask') await this.ctx.errand.ask();
    else if (stage === 'bring') await this.ctx.errand.deliver();
    else this.ctx.say(this.tip ?? phrases.fridgeNow);
  }

  /** Everybody at the table: what the child helped to make. */
  async eatLunch(icon: string): Promise<void> {
    await this.scene('table', async () => {
      const { avatar } = this.ctx;
      this.sitAt(CHAIR, CHAIR_HEIGHT);
      this.ctx.guardianStandsAt('table');
      this.ctx.say(phrases.lunchEat);
      const bites: readonly Picture[] = [1, 2, 3].map(() => ({ icon, label: 'Comer' }));
      for (let bite = 0; bite < bites.length; bite += 1) {
        await this.sheet.press(bites, bite);
        avatar.playEmote('SitEat');
        await wait(800);
        this.house.bite();
        await wait(700);
        avatar.playEmote('Sit');
      }
      avatar.feel('happy');
      this.ctx.say(phrases.lunchDone);
      await wait(1800);
      avatar.feel('calm');
      this.house.clearTable();
      this.standUp(standSpots.table);
      this.ctx.guardianStandsAt('kitchen');
      await this.complete('lunch');
      return phrases.lunchDone;
    });
  }

  private async door(): Promise<void> {
    if (this.step === 'lunch' && this.errand?.stage !== 'shop') {
      this.ctx.say(this.tip ?? phrases.firstThis(stepLooks.lunch.name));
      return;
    }
    if (this.step === undefined || currentBlock(this.day)?.id === 'night') {
      this.ctx.say(phrases.nightStays);
      return;
    }
    if (!this.isOpen('outside') && !this.isOpen('lunch')) {
      this.ctx.say(phrases.firstThis(stepLooks[this.step].name));
      return;
    }
    const { weather } = this.ctx;
    const { outfit, avatarId } = this.ctx.profile;
    if (!this.warnedDoor && avatarId === 'child' && !fitsWeather(weather, outfit)) {
      this.warnedDoor = true;
      this.ctx.say(outfitTips[weather]);
      return;
    }
    this.busy = true;
    this.ctx.enterPanel('home');
    try {
      await this.ctx.goOutside();
      this.house.show(undefined);
      this.ctx.backToExploring(this.ctx.errand.tip ?? phrases.outsideNow);
    } catch {
      this.ctx.backToExploring(phrases.streetNotReady);
    } finally {
      this.busy = false;
    }
  }

  private async sleep(): Promise<void> {
    await this.scene('bed', async () => {
      await this.ctx.transition(() => {
        this.goToBed();
      });
      this.ctx.say(phrases.goodNight(this.ctx.profile.name));
      await wait(2200);
      await this.complete('sleep');
      await this.begin(false, undefined);
      return this.tip;
    });
  }
}
