import * as THREE from 'three';
import { phrases } from '@application/phrases';
import type { GameServices, PlayerServices } from '@application/game-services';
import type { Ambience, SoundEffect } from '@application/ports/audio';
import type { Goal } from '@application/use-cases/suggest-next-goal';
import {
  CHILD_AVATAR_ID,
  defaultChildChoices,
  type ChildChoices,
  type OutfitId,
} from '@domain/avatar/child';
import { firstDay, type DayState } from '@domain/day/day-plan';
import { comfortIn, phaseOf, weatherOf, type Phase, type Weather } from '@domain/day/weather';
import { startRoutine, stepRoutine, type Spot } from '@domain/people/routine';
import type { PlayerProfile } from '@domain/profile/player-profile';
import type { Station } from '@domain/curriculum/skill';
import { isBakeryRun } from '@domain/errand/errand';
import { sessionTimeStatus } from '@domain/session/session';
import { defaultSettings, type Settings } from '@domain/settings/settings';
import { Mascot } from '@presentation/actors/mascot';
import { AvatarLibrary } from '@presentation/actors/avatar-library';
import { avatarPictureUrl } from '@presentation/actors/avatar-rigs';
import {
  cast,
  childPerson,
  guardianPerson as personOfGuardian,
  type CastMember,
} from '@presentation/actors/cast';
import { outfitClothes, type Expression } from '@presentation/actors/child-figure';
import type { Emote, Ground, Player } from '@presentation/actors/player';
import { MenuController } from '@presentation/controllers/menu-controller';
import { ActivityController } from '@presentation/controllers/activity-controller';
import { MissionController, missionPlaces } from '@presentation/controllers/mission-controller';
import { HomeController } from '@presentation/controllers/home-controller';
import { ErrandController } from '@presentation/controllers/errand-controller';
import { SchoolController } from '@presentation/controllers/school-controller';
import { SessionController } from '@presentation/controllers/session-controller';
import { WardrobeController } from '@presentation/controllers/wardrobe-controller';
import { CameraRig } from '@presentation/engine/camera-rig';
import { GamepadReader, padIsActive } from '@presentation/engine/gamepad';
import { gameKey, Input, isTyping } from '@presentation/engine/input';
import { QualityGovernor, type Quality } from '@presentation/engine/quality';
import { seededRandom } from '@presentation/engine/math';
import { cameraRelative } from '@presentation/engine/movement';
import { createRenderer, fitToContainer, pixelRatioFor } from '@presentation/engine/renderer';
import type { GameContext, Mode, PanelMode } from '@presentation/game-context';
import { Controls } from '@presentation/ui/controls';
import { Dialog } from '@presentation/ui/dialog';
import { h } from '@presentation/ui/dom';
import { Hud } from '@presentation/ui/hud';
import { Minimap } from '@presentation/ui/minimap';
import type { Gesture } from '@presentation/ui/controls';
import { CalmPause } from '@presentation/ui/calm-pause';
import { ChildCreator } from '@presentation/ui/child-creator';
import { ChildStudio } from '@presentation/ui/child-studio';
import { LoadingScreen } from '@presentation/ui/loading-screen';
import { PadFocus } from '@presentation/ui/pad-focus';
import {
  colliderOf,
  nearestPerson,
  neighbors,
  standingGround,
  type Person,
} from '@presentation/world/neighbors';
import { PadHints } from '@presentation/ui/pad-hints';
import { ProfileScreen } from '@presentation/ui/profile-screen';
import { RestScreen } from '@presentation/ui/rest-screen';
import { CITY, CityPlace } from '@presentation/world/city';
import { firstObstruction, resolveCollisions } from '@presentation/world/collision';
import { GameWorld } from '@presentation/world/game-world';
import { skyLook } from '@presentation/world/sky-looks';
import type { Town } from '@presentation/world/town';
import type { WalkableSpace } from '@presentation/world/game-world';
import { GoalMarker } from '@presentation/world/goal-marker';
import { GuideArrow } from '@presentation/world/guide-arrow';
import type { Interactable } from '@presentation/world/interactable';
import { captureMap } from '@presentation/world/map-snapshot';
import type { RoadEvent } from '@presentation/world/road-safety';
import { standSpots, thingOf } from '@presentation/world/house';
import { WorldAssets } from '@presentation/world/world-assets';
import '@presentation/ui/styles.css';

export interface GameAppOptions {
  /** Where public assets are served from (Vite's BASE_URL). */
  readonly baseUrl: string;
  readonly seed?: number;
}

const AUTOSAVE_MS = 10_000;
const TIME_CHECK_MS = 5_000;
const EXTRA_TIME_MS = 5 * 60_000;
/** Seconds between two spoken street warnings. */
const ROAD_WARNING_GAP = 6;
/** In the calm town the engines are quieter and nobody honks. */
const CALM_STREET = 0.4;
/** Rare, and only from a distance. */
const HORN_EVERY = 60;

const isHeardInside = (sound: Ambience): boolean => sound !== 'birds' && sound !== 'street';

/** Seconds between greetings: one wave at a time, even if the button is pressed again. */
const GREET_GAP = 2.5;
/** Rooms are smaller than streets: the arrow and Lilo fit them. */
const INDOOR_MARKER = 0.42;
const INDOOR_MASCOT = 0.6;
/** Where the adult at home is, at the kitchen counter. */
const KITCHEN_SPOT = { x: 5, z: 1.5, facing: 0 } as const;
const GUARDIAN_SPOTS = {
  kitchen: KITCHEN_SPOT,
  fridge: { x: 5, z: 1.7, facing: 1.2 },
  stove: { x: 2.2, z: 1.5, facing: Math.PI / 2 },
  table: { x: 2.85, z: 2.75, facing: 0 },
} as const;
const GUARDIAN_SEAT = 0.2;
/** The child's body and a person's: they meet, but never overlap. */
const PERSON_SPACE = 0.45;
const still = { x: 0, z: 0 };
/** How fast the number shown in the dev stats follows each frame. */
const FPS_SMOOTHING = 0.05;
const cameraSpeeds = { low: 0.55, normal: 1, high: 1.6 } as const;

/**
 * Runs the 3D game. It only talks to the application layer through
 * GameServices, so rules (coins, hints, unlocks) stay out of rendering code.
 */
export class GameApp implements GameContext {
  private currentMode: Mode = 'loading';
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
  private readonly ui = h('div', { className: 'ui' });
  private readonly fade = h('div', { className: 'fade', attrs: { 'aria-hidden': 'true' } });
  private readonly hud = new Hud(
    () => {
      if (this.currentMode === 'explore') this.menus.open();
    },
    () => {
      this.togglePause();
    },
  );
  private readonly calmPause = new CalmPause(() => {
    this.togglePause();
  });
  /** What the pause interrupted, to go back to exactly that. */
  private beforePause: Mode | undefined;
  readonly dialog = new Dialog();
  private readonly marker = new GoalMarker();
  private readonly guide = new GuideArrow();
  private readonly mascot = new Mascot();
  private readonly minimap = new Minimap(() => {
    if (this.currentMode === 'explore') this.menus.openMap();
  });
  private readonly controls: Controls;
  private readonly profileScreen: ProfileScreen;
  private readonly restScreen: RestScreen;
  private readonly missions: MissionController;
  private readonly errands: ErrandController;
  private readonly schoolDay: SchoolController;
  private readonly learning: ActivityController;
  private readonly day: SessionController;
  readonly wardrobe: WardrobeController;
  readonly home: HomeController;
  private readonly menus: MenuController;
  private readonly avatars: AvatarLibrary;
  private readonly gamepad = new GamepadReader((connected) => {
    this.input?.reset();
    this.showPadControls(connected);
    this.say(connected ? phrases.padConnected : phrases.padDisconnected);
  });
  private readonly padFocus: PadFocus;
  private readonly padHints = new PadHints();

  private renderer: THREE.WebGLRenderer | undefined;
  private gameWorld: GameWorld | undefined;
  private character: Player | undefined;
  private cameraRig: CameraRig | undefined;
  private input: Input | undefined;
  private activeProfile: PlayerProfile | undefined;
  private playerServices: PlayerServices | undefined;
  private currentSettings: Settings = defaultSettings;
  private readonly deviceReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private goal: Goal = { kind: 'explore' };
  private destination: Interactable | undefined;
  private lastTime = 0;
  private elapsed = 0;
  private playedMs = 0;
  private lastSave = 0;
  private lastTimeCheck = 0;
  private warnedLastMission = false;
  /** Crossed on a zebra with no warning since the last place visited. */
  private safeTrip = false;
  private returningToSidewalk = false;
  private lastRoadWarning = -Infinity;
  private lastGreeting = -Infinity;
  private nextHorn = HORN_EVERY;
  private readonly governor = new QualityGovernor();
  private readonly loading = new LoadingScreen();
  private fps = 60;
  private people: readonly Person[] = [];
  private guardianPerson: Person | undefined;
  private today: DayState = firstDay;
  private readonly breath = new THREE.Vector3();
  private readonly studio = new ChildStudio();
  private readonly creator = new ChildCreator(this.studio, {
    onSpeak: (text) => void this.services.speech.speak(text),
  });
  private characterKey: string | undefined;

  constructor(
    private readonly root: HTMLElement,
    readonly services: GameServices,
    private readonly options: GameAppOptions,
  ) {
    this.padFocus = new PadFocus(this.root);
    this.controls = new Controls({
      onMove: (move) => this.input?.setJoystick(move),
      onGesture: () => this.input?.requestGesture(),
      onAgenda: () => {
        if (this.currentMode === 'explore') this.home.openAgenda();
      },
      onAction: () => this.input?.requestAction(),
    });
    this.profileScreen = new ProfileScreen({
      onSelect: (profile) => void this.selectProfile(profile),
      onCreate: (name) => {
        this.newChild(name);
      },
      onRename: (profile, name) => void this.renameProfile(profile, name),
      onDelete: (profile) => void this.deleteProfile(profile),
    });
    this.restScreen = new RestScreen({
      onFinish: () => {
        this.restScreen.close();
        void this.switchPlayer();
      },
      onExtend: () => {
        this.playedMs = Math.max(0, this.playedMs - EXTRA_TIME_MS);
        this.warnedLastMission = false;
        this.restScreen.close();
        this.services.audio.startMusic();
        this.backToExploring();
      },
    });
    this.avatars = new AvatarLibrary(options.baseUrl);
    this.missions = new MissionController(this);
    this.learning = new ActivityController(this);
    this.day = new SessionController(this, this.learning);
    this.wardrobe = new WardrobeController(this);
    this.home = new HomeController(this);
    this.errands = new ErrandController(this, this.home);
    this.schoolDay = new SchoolController(this, this.home, this.learning);
    this.menus = new MenuController(this, () => this.goalPlace()?.id);
  }

  // ---------- GameContext ----------

  get restIsDue(): boolean {
    const limit = this.currentSettings.sessionLimitMinutes;
    return sessionTimeStatus(limit, this.playedMs, false).kind === 'time-to-rest';
  }

  get session(): SessionController {
    return this.day;
  }

  get errand(): ErrandController {
    return this.errands;
  }

  get guardian(): Player | undefined {
    return this.guardianPerson?.character;
  }

  guardianStandsAt(where: 'kitchen' | 'fridge' | 'stove' | 'table'): void {
    const spot = GUARDIAN_SPOTS[where];
    const person = this.guardianPerson;
    if (person === undefined) return;
    const { character } = person;
    character.setPerch(where === 'table' ? GUARDIAN_SEAT : 0);
    character.release();
    character.placeAt(this.world.house.world(spot), spot.facing);
    if (where === 'table' && character.canDo('Sit')) character.playEmote('Sit');
  }

  get school(): SchoolController {
    return this.schoolDay;
  }

  enterSpace(space: WalkableSpace): void {
    const world = this.world;
    world.setInside(space);
    this.minimap.setVisible(false);
    this.rig.setIndoors(true);
    this.avatar.placeAt(space.entrance, Math.PI);
    this.rig.snapTo(space.entrance);
  }

  leaveSpace(doorId: string): void {
    const world = this.world;
    world.setInside(undefined);
    this.rig.setIndoors(false);
    const door = world.townPlaces.find((place) => place.id === doorId);
    if (door === undefined) return;
    const towardStreet = door.position.z > CITY.z ? Math.PI : 0;
    this.avatar.placeAt(door.position, towardStreet);
    this.rig.yaw = towardStreet;
    this.rig.snapTo(door.position);
  }

  addClassmate(member: CastMember): Player {
    const character = this.addPerson(member);
    this.people = [...this.people, { character, reply: phrases.replyHello }];
    return character;
  }

  refreshGoal(): void {
    this.showMarker();
  }

  practice(subject: Station, onLeave: () => void): Promise<void> {
    return this.learning.open(subject, onLeave);
  }

  get player(): PlayerServices {
    if (this.playerServices === undefined) throw new Error('No player selected');
    return this.playerServices;
  }

  get profile(): PlayerProfile {
    if (this.activeProfile === undefined) throw new Error('No player selected');
    return this.activeProfile;
  }

  get settings(): Settings {
    return this.currentSettings;
  }

  get world(): GameWorld {
    if (this.gameWorld === undefined) throw new Error('World not ready');
    return this.gameWorld;
  }

  get avatar(): Player {
    if (this.character === undefined) throw new Error('Character not ready');
    return this.character;
  }

  get rig(): CameraRig {
    if (this.cameraRig === undefined) throw new Error('Camera not ready');
    return this.cameraRig;
  }

  get mode(): Mode {
    return this.currentMode;
  }

  enterPanel(mode: PanelMode): void {
    this.currentMode = mode;
    this.ui.classList.add('has-panel');
    this.controls.setVisible(false);
    this.controls.hideAction();
    this.marker.group.visible = false;
    this.minimap.setVisible(false);
    if (this.input !== undefined) {
      this.input.enabled = false;
      this.input.lookOnly = false;
      this.input.reset();
    }
  }

  letLookAround(): void {
    if (this.input !== undefined) this.input.lookOnly = true;
  }

  backToExploring(message?: string): void {
    this.services.speech.stop();
    this.ui.classList.remove('has-panel');
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.cameraRig?.clearFocus();
    this.currentMode = 'explore';
    this.controls.setVisible(true);
    this.showMinimap();
    if (this.input !== undefined) {
      this.input.reset();
      this.input.enabled = true;
    }
    void this.refresh().then(() => {
      if (this.destination === undefined) this.say(message ?? this.goalMessage());
    });
  }

  say(message: string, written = message): void {
    this.dialog.say(written);
    void this.services.speech.speak(message);
  }

  sound(effect: SoundEffect): void {
    this.services.audio.play(effect);
  }

  async refresh(): Promise<void> {
    if (this.playerServices === undefined) return;
    const player = this.playerServices;
    const [progress, wardrobe, goal] = await Promise.all([
      player.getPlayerProgress.execute(),
      player.getWardrobe.execute(),
      player.suggestNextGoal.execute(),
    ]);
    this.hud.set(progress.coins.amount, progress.stars);
    this.character?.dress(
      progress.equipped,
      wardrobe.entries.map((entry) => entry.item),
    );
    this.goal = goal;
    this.showMarker();
  }

  applySettings(settings: Settings): void {
    const fixed = this.currentSettings.fixedWeather;
    this.currentSettings = settings;
    if (fixed !== settings.fixedWeather && this.activeProfile !== undefined) {
      this.showDay(this.today);
    }
    if (this.renderer !== undefined) {
      this.renderer.domElement.style.filter = settings.softColors
        ? 'saturate(0.68) brightness(1.03)'
        : '';
    }
    this.root.classList.toggle('reduce-motion', settings.reducedMotion);
    // The device setting counts too: CSS follows it by itself, the 3D world does not.
    const motion = settings.reducedMotion || this.deviceReducedMotion.matches ? 0.3 : 1;
    this.gameWorld?.setMotionScale(motion);
    this.gameWorld?.setCalm(settings.worldActivity === 'calm');
    this.mascot.motionScale = motion;
    this.marker.motionScale = motion;
    if (this.cameraRig !== undefined) {
      this.cameraRig.sensitivity = cameraSpeeds[settings.cameraSensitivity];
    }
    if (this.currentMode === 'explore') this.showMinimap();
  }

  private showMinimap(): void {
    const indoors = this.gameWorld?.indoors ?? true;
    const shopping = this.gameWorld?.inside !== undefined;
    this.minimap.setVisible(this.currentSettings.showMinimap && !indoors && !shopping);
  }

  get town(): Town {
    const town = this.gameWorld?.outside;
    if (town === undefined) throw new Error('Town not ready');
    return town;
  }

  async stopPoint(): Promise<void> {
    await this.saveSession();
    this.lastTimeCheck = 0;
    this.say(phrases.blockDone);
  }

  whileNotPaused(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.beforePause === undefined) resolve();
        else window.setTimeout(check, 200);
      };
      check();
    });
  }

  async goOutside(): Promise<void> {
    const world = this.world;
    const first = world.outside === undefined;
    const town = await this.whileLoading(world.openTown());
    const door = world.street;
    if (first) this.addNeighbors(town);
    await this.transition(() => {
      this.setIndoors(false);
      if (door === undefined) return;
      // Looking down the street to the market, with the bus stop out of the way.
      this.avatar.placeAt(door.position, Math.PI / 2);
      this.rig.yaw = -Math.PI / 2;
      this.rig.snapTo(door.position);
      if (first) this.pictureTheMap(town);
    });
    this.fade.classList.remove('is-on');
  }

  async goInside(): Promise<void> {
    await this.transition(() => {
      this.setIndoors(true);
    });
    this.rig.snapTo(this.avatar.position);
  }

  private setIndoors(indoors: boolean): void {
    this.world.setIndoors(indoors);
    this.rig.setIndoors(indoors);
    this.marker.setSize(indoors ? INDOOR_MARKER : 1);
    this.showComfort();
    this.playAmbience();
    this.mascot.root.scale.setScalar(indoors ? INDOOR_MASCOT : 1);
  }

  /** The map's picture, taken once behind the fade of the first time outside. */
  private pictureTheMap(town: Town): void {
    const renderer = this.renderer;
    if (renderer === undefined) return;
    town.showAllZones(true);
    const picture = captureMap(
      renderer,
      this.scene,
      [this.avatar.root, this.mascot.root, this.marker.group],
      (visible) => {
        town.setCloudsVisible(visible);
      },
    );
    town.showAllZones(false);
    this.menus.map.setPicture(picture);
    this.minimap.setPicture(picture);
  }

  setDestination(place: Interactable | undefined): void {
    this.destination = place;
    this.showMarker();
  }

  async switchPlayer(): Promise<void> {
    await this.saveSession();
    this.services.speech.stop();
    this.services.audio.stopMusic();
    this.missions.close();
    this.learning.close();
    this.errands.close();
    this.schoolDay.close();
    this.day.close();
    this.wardrobe.close();
    this.menus.closeAll();
    this.restScreen.close();
    this.enterPanel('menu');
    this.currentMode = 'profiles';
    this.hud.setTimeLeft(undefined, false);
    this.profileScreen.show(await this.services.listProfiles.execute());
  }

  async changeAvatar(avatarId: string): Promise<void> {
    const result = await this.services.changeAvatar.execute(this.profile.id, avatarId);
    if (!result.ok) return;
    this.activeProfile = result.value;
    await this.useAvatar(result.value);
    await this.refresh();
  }

  async changeOutfit(outfit: OutfitId): Promise<void> {
    const result = await this.services.changeChild.execute(this.profile.id, { outfit });
    if (!result.ok) return;
    this.activeProfile = result.value;
    this.character?.wear(outfitClothes[outfit]);
    this.showComfort();
  }

  showDay(day: DayState): void {
    this.today = day;
    this.world.setMoment(phaseOf(day), this.weather);
    this.showComfort();
    this.playAmbience();
  }

  get weather(): Weather {
    const seed = this.activeProfile?.id ?? '';
    return weatherOf(this.today.number, seed, this.currentSettings.fixedWeather);
  }

  /** The body answers the weather outside; indoors everyone is fine. */
  private showComfort(): void {
    const outside = this.gameWorld?.indoors === false;
    const child = this.activeProfile?.avatarId === CHILD_AVATAR_ID;
    const outfit = this.activeProfile?.outfit ?? 'home';
    this.character?.setPosture(outside && child ? comfortIn(this.weather, outfit) : 'fine');
  }

  private playAmbience(): void {
    const { weather } = this;
    const night = phaseOf(this.today) === 'night';
    const sounds: Ambience[] = [night ? 'crickets' : 'birds', 'street'];
    if (weather === 'rain') sounds.push('rain');
    if (weather === 'wind') sounds.push('wind');
    const indoors = this.gameWorld?.indoors === true;
    this.services.audio.setAmbience(indoors ? sounds.filter(isHeardInside) : sounds);
  }

  private breathSpot(player: Player): THREE.Vector3 {
    return this.breath
      .copy(player.position)
      .add(new THREE.Vector3(Math.sin(player.facing) * 0.4, 1.15, Math.cos(player.facing) * 0.4));
  }

  editChild(changed: () => void): void {
    const { profile } = this;
    this.creator.open(
      profile,
      '✓ Pronto',
      (choices) => {
        void this.saveChild(choices).then(changed);
      },
      () => undefined,
    );
  }

  private async saveChild(choices: ChildChoices): Promise<void> {
    const result = await this.services.changeChild.execute(this.profile.id, choices);
    if (!result.ok) return;
    this.activeProfile = result.value;
    await this.useAvatar(result.value);
    await this.refresh();
    this.say(phrases.childChanged);
  }

  avatarPicture(avatarId: string): string {
    if (avatarId === CHILD_AVATAR_ID && this.activeProfile !== undefined) {
      return this.profilePicture({ ...this.activeProfile, avatarId });
    }
    return avatarPictureUrl(this.options.baseUrl, avatarId);
  }

  outfitPicture(outfit: OutfitId): string {
    return this.studio.picture(childPerson(this.profile.look, outfit), 'body');
  }

  private profilePicture(profile: PlayerProfile): string {
    return profile.avatarId === CHILD_AVATAR_ID
      ? this.studio.picture(childPerson(profile.look, profile.outfit), 'face')
      : avatarPictureUrl(this.options.baseUrl, profile.avatarId);
  }

  /** Replaces the 3D character in place (same spot, same direction). */
  private async useAvatar(profile: PlayerProfile): Promise<void> {
    const { avatarId, look, outfit } = profile;
    const isChild = avatarId === CHILD_AVATAR_ID;
    const key = isChild ? JSON.stringify(look) : avatarId;
    if (this.characterKey === key) {
      this.character?.wear(outfitClothes[outfit]);
      return;
    }
    const next = isChild
      ? this.avatars.createPerson(childPerson(look, outfit))
      : await this.avatars.create(avatarId);
    this.characterKey = key;
    const previous = this.character;
    if (previous !== undefined) {
      next.placeAt(previous.position, previous.facing);
      previous.dispose();
    }
    this.scene.add(next.root);
    this.character = next;
  }

  // ---------- Start ----------

  async start(): Promise<void> {
    this.ui.append(
      this.hud.element,
      this.minimap.element,
      this.dialog.element,
      this.controls.element,
      this.missions.panel.element,
      this.learning.panel.element,
      this.errands.panel.element,
      this.day.board.element,
      this.home.agenda.element,
      this.home.sheet.element,
      this.wardrobe.panel.element,
      ...this.menus.elements,
      this.restScreen.element,
      this.calmPause.element,
      this.padHints.element,
      this.fade,
    );
    this.root.append(this.ui, this.profileScreen.element, this.creator.element);
    this.ui.addEventListener(
      'click',
      (event) => {
        if ((event.target as HTMLElement).closest('button') !== null) this.sound('tap');
      },
      true,
    );

    try {
      const renderer = createRenderer(this.root);
      this.root.insertBefore(renderer.domElement, this.ui);
      this.renderer = renderer;
      fitToContainer(renderer, this.camera, this.root);
      window.addEventListener('resize', () => {
        fitToContainer(renderer, this.camera, this.root);
      });

      const world = new GameWorld(this.scene, seededRandom(this.options.seed ?? 20261028), () =>
        WorldAssets.load(this.options.baseUrl),
      );
      this.gameWorld = world;
      const player = this.avatars.createPerson(
        childPerson(defaultChildChoices.look, defaultChildChoices.outfit),
      );
      this.character = player;
      const start = world.house.world(standSpots.bed);
      player.placeAt(start, standSpots.bed.facing);
      this.mascot.placeNear(start);
      this.scene.add(player.root, this.mascot.root, this.marker.group, this.guide.group);

      this.cameraRig = new CameraRig(
        this.camera,
        (x, z) => world.heightAt(x, z),
        (from, to) => firstObstruction(from, to, world.colliders),
      );
      this.cameraRig.setIndoors(true);
      this.cameraRig.snapTo(player.position);
      this.input = new Input(renderer.domElement);
      this.enterPanel('menu');
      this.currentMode = 'profiles';

      renderer.compile(this.scene, this.camera);
      renderer.setAnimationLoop((time) => {
        this.frame(time);
      });
      this.listenToPage();
      this.loading.hide();
      // The house is open: the street comes down quietly while the child plays.
      world.downloadTown();
      if (import.meta.env.DEV) this.exposeDevTools();

      this.profileScreen.setPictures((profile) => this.profilePicture(profile));
      this.profileScreen.show(await this.services.listProfiles.execute());
    } catch (error) {
      console.error(error);
      this.loading.hide();
      this.profileScreen.setLoading('Não foi possível abrir o jogo. Tente recarregar a página.');
    }
  }

  // ---------- Profiles ----------

  private async selectProfile(profile: PlayerProfile): Promise<void> {
    const result = await this.services.selectProfile.execute(profile.id);
    if (result.ok) await this.beginProfile(result.value, false);
  }

  /** After the name, the child creates themself. Costumes are in the wardrobe. */
  private newChild(name: string): void {
    this.creator.open(
      defaultChildChoices,
      '▶ Começar',
      (choices) => void this.createProfile(name, choices),
      () => undefined,
    );
  }

  private async createProfile(name: string, choices: ChildChoices): Promise<void> {
    const result = await this.services.createProfile.execute(name, CHILD_AVATAR_ID, choices);
    if (result.ok) await this.beginProfile(result.value, true);
  }

  private async renameProfile(profile: PlayerProfile, name: string): Promise<void> {
    await this.services.renameProfile.execute(profile.id, name);
    this.profileScreen.show(await this.services.listProfiles.execute());
  }

  private async deleteProfile(profile: PlayerProfile): Promise<void> {
    await this.services.deleteProfile.execute(profile.id);
    this.profileScreen.show(await this.services.listProfiles.execute());
  }

  /** Loads one child's settings, progress and last position, then starts playing. */
  private async beginProfile(profile: PlayerProfile, isNew: boolean): Promise<void> {
    const renderer = this.renderer;
    if (renderer === undefined) return;
    this.activeProfile = profile;
    this.playerServices = this.services.forPlayer(profile.id);
    this.profileScreen.setLoading(`Preparando ${profile.name}…`);
    await this.useAvatar(profile);
    this.applySettings(await this.player.applySettings.execute());

    const session = await this.player.loadSession.execute();
    const world = this.world;
    this.rig.clearFocus();
    world.setInside(undefined);
    this.setIndoors(true);
    this.addGuardian(profile, world);
    const resumeAt =
      session !== undefined && world.house.contains(session.x, session.z)
        ? new THREE.Vector3(session.x, world.house.floor, session.z)
        : undefined;

    this.playedMs = 0;
    this.warnedLastMission = false;
    this.destination = undefined;
    await this.refresh();

    this.fade.classList.remove('is-on');
    this.profileScreen.hide();
    this.services.audio.startMusic();
    this.backToExploringQuietly();
    await this.home.begin(isNew, resumeAt);
    this.rig.snapTo(this.avatar.position);
    this.mascot.placeNear(this.avatar.position);
    if (this.currentMode === 'explore') {
      this.say(isNew ? phrases.hello(profile.name) : phrases.welcomeBack(profile.name));
    }
    this.showMarker();
  }

  private backToExploringQuietly(): void {
    this.ui.classList.remove('has-panel');
    this.cameraRig?.clearFocus();
    this.currentMode = 'explore';
    this.controls.setVisible(true);
    this.showMinimap();
    if (this.input !== undefined) {
      this.input.reset();
      this.input.enabled = true;
    }
    this.showMarker();
  }

  // ---------- Loop ----------

  private frame(timeMs: number): void {
    const { renderer, gameWorld: world, character: player, cameraRig: rig, input } = this;
    if (
      renderer === undefined ||
      world === undefined ||
      player === undefined ||
      rig === undefined ||
      input === undefined
    )
      return;

    const dt = Math.min(0.05, this.lastTime === 0 ? 0 : (timeMs - this.lastTime) / 1000);
    this.lastTime = timeMs;
    this.elapsed += dt;
    if (dt > 0) this.fps += (1 / dt - this.fps) * FPS_SMOOTHING;
    const quality = this.governor.sample(dt);
    if (quality !== undefined) this.applyQuality(quality, renderer, world);

    const exploring = this.currentMode === 'explore';
    this.pollGamepad(dt, input, exploring);
    const look = input.consumeLook();
    if (exploring || input.lookOnly) rig.rotate(look.x, look.y);

    const move = exploring ? input.move : { x: 0, y: 0, running: false };
    if (exploring && input.consumeGesture()) this.gesture(player, world);
    const standing = standingGround(world);
    const steered = this.home.steer(player.position);
    if (steered !== undefined) player.update(dt, steered, true, standing);
    else player.update(dt, cameraRelative(move, rig.yaw), move.running, world);
    this.updatePeople(dt, player, standing);
    this.watchTheStreet(player, world);

    const cameraYaw = Math.atan2(
      this.camera.position.x - player.position.x,
      this.camera.position.z - player.position.z,
    );
    this.mascot.update(this.elapsed, dt, player.position, cameraYaw);
    this.marker.update(this.elapsed);
    this.showGuide(player, world, exploring);
    world.update(this.elapsed, dt, player.position, this.breathSpot(player));
    rig.update(dt, player.position);

    if (exploring) {
      this.updateExploration(player.position, input, world);
      this.watchTheRoad(player.position, world);
      this.missions.update(player.position);
      const goal = this.goalPlace();
      this.minimap.draw(
        { x: player.position.x, z: player.position.z, facing: player.facing },
        goal === undefined
          ? undefined
          : { x: goal.position.x, z: goal.position.z, icon: goal.icon },
      );
    }
    this.missions.tick(dt);
    this.errands.update(dt);
    this.schoolDay.update(dt);
    if (this.activeProfile !== undefined && this.currentMode !== 'profiles') {
      this.trackSession(dt);
    }

    renderer.render(this.scene, this.camera);
  }

  /** Controller: plays the game while exploring, moves the focus in panels. */
  private pollGamepad(dt: number, input: Input, exploring: boolean): void {
    const pad = this.gamepad.poll();
    if (pad === undefined) return;
    if (!pad.selectHeld) this.padFocus.release();
    if (padIsActive(pad)) this.showPadControls(true);
    if (exploring) {
      input.applyPad(pad, dt);
      if (pad.menu) this.goBack();
      if (pad.agenda) this.home.openAgenda();
      if (pad.pause) this.togglePause();
      return;
    }
    if (pad.pause) this.togglePause();
    if (input.lookOnly) input.applyPadLook(pad, dt);
    if (!document.body.classList.contains('is-pad')) return;
    this.padFocus.keep();
    if (pad.navigate !== undefined) this.padFocus.move(pad.navigate);
    if (pad.select) this.padFocus.press();
    if (pad.back || pad.menu) this.goBack();
    if (pad.agenda && this.currentMode === 'session') this.goBack();
  }

  /** Shows the controller's buttons on screen and hides the touch controls. */
  private showPadControls(active: boolean): void {
    document.body.classList.toggle('is-pad', active);
    if (active) this.padHints.setStyle(this.gamepad.style);
  }

  /** A pause on top of whatever is happening, which waits there unchanged. */
  private togglePause(): void {
    const paused = this.beforePause;
    // At home the calm button leads to the calm corner; anywhere else it is a pause.
    const atHome = this.gameWorld?.indoors === true && this.gameWorld.inside === undefined;
    if (paused === undefined && atHome && this.currentMode === 'explore') {
      void this.home.calmCorner();
      return;
    }
    if (paused !== undefined) {
      this.beforePause = undefined;
      this.calmPause.hide();
      if (paused === 'explore') this.backToExploring(phrases.pauseBack);
      else this.currentMode = paused;
      return;
    }
    const mode = this.currentMode;
    if (mode === 'loading' || mode === 'profiles' || mode === 'rest') return;
    this.beforePause = mode;
    this.services.speech.stop();
    if (mode === 'explore') this.enterPanel('pause');
    else this.currentMode = 'pause';
    this.calmPause.show();
    this.say(phrases.pauseOpen);
  }

  /** Esc, or B / Start on a controller: opens the menu or closes what is open. */
  private goBack(): void {
    if (this.creator.isOpen) this.creator.back();
    else if (this.currentMode === 'home') return;
    else if (this.currentMode === 'pause') this.togglePause();
    else if (this.currentMode === 'explore') this.menus.open();
    else if (this.currentMode === 'menu') {
      this.menus.closeAll();
      this.backToExploring();
    } else if (this.currentMode === 'wardrobe') {
      this.wardrobe.leave();
    } else if (this.currentMode === 'mission') void this.missions.exit();
    else if (this.currentMode === 'learning') this.learning.exit();
    else if (this.currentMode === 'session') {
      this.home.closeAgenda();
      this.day.later();
    }
  }

  /** Calm street rules: a warning brings the child back, and safe trips earn coins. */
  private watchTheRoad(position: THREE.Vector3, world: GameWorld): void {
    const town = world.outside;
    if (this.missions.isCrossingStreet || this.returningToSidewalk) return;
    if (town === undefined || world.indoors) return;
    const event = town.roadSafety.update(position.x, position.z, town.trafficPhase.walk);
    if (event === 'crossed') {
      this.safeTrip = true;
    } else if (event !== undefined) {
      this.safeTrip = false;
      void this.backToSidewalk(event, world);
    }
  }

  private async backToSidewalk(event: RoadEvent, world: GameWorld): Promise<void> {
    const spot = world.outside?.roadSafety.lastSafeSpot;
    if (spot === undefined) return;
    this.returningToSidewalk = true;
    if (this.input !== undefined) this.input.enabled = false;
    // Said once in a while: repeating it at every step would only nag.
    if (this.elapsed - this.lastRoadWarning > ROAD_WARNING_GAP) {
      this.lastRoadWarning = this.elapsed;
      this.sound('hint');
      this.say(event === 'red-light' ? phrases.redLight : phrases.keepToSidewalk);
    }
    await this.transition(() => {
      this.character?.placeAt(
        new THREE.Vector3(spot.x, world.heightAt(spot.x, spot.z), spot.z),
        this.character.facing,
      );
      world.outside?.roadSafety.reset();
    });
    if (this.input !== undefined && this.currentMode === 'explore') {
      this.input.enabled = true;
      this.input.stopUntilReleased();
    }
    this.returningToSidewalk = false;
  }

  /** Reaching a place after crossing safely gives a small prize. */
  private async rewardSafeTrip(): Promise<void> {
    if (!this.safeTrip || this.playerServices === undefined) return;
    this.safeTrip = false;
    await this.playerServices.rewardSafeTrip.execute();
    this.sound('coin');
    await this.refresh();
  }

  private applyQuality(quality: Quality, renderer: THREE.WebGLRenderer, world: GameWorld): void {
    renderer.setPixelRatio(pixelRatioFor(quality));
    world.setQuality(quality);
  }

  /** ▢: greets who is close. On a playground with nobody around, jumps. */
  private gesture(player: Player, world: GameWorld): void {
    if (this.gestureNow(player.position, world) === 'jump') {
      if (player.isGrounded) {
        player.jump();
        this.sound('jump');
      }
      return;
    }
    if (this.elapsed - this.lastGreeting < GREET_GAP) return;
    this.lastGreeting = this.elapsed;
    player.playEmote('Wave');
    const person = nearestPerson(this.people, player.position);
    if (person === undefined) return;
    player.faceTowards(person.character.position);
    person.character.faceTowards(player.position);
    person.character.playEmote('Wave');
    this.say(person.reply);
  }

  private gestureNow(position: THREE.Vector3, world: GameWorld): Gesture {
    const someoneHere = nearestPerson(this.people, position) !== undefined;
    return !someoneHere && world.canJumpAt(position.x, position.z) ? 'jump' : 'greet';
  }

  /** The adult at home, in the kitchen, looks like the child's family. */
  private addGuardian(profile: PlayerProfile, world: GameWorld): void {
    const others = this.people.filter((person) => person !== this.guardianPerson);
    this.guardianPerson?.character.dispose();
    const character = this.avatars.createPerson(personOfGuardian(profile.guardian, profile.look));
    character.placeAt(world.house.world(KITCHEN_SPOT), KITCHEN_SPOT.facing);
    this.scene.add(character.root);
    this.guardianPerson = { character, reply: phrases.replyGoodDay };
    this.people = [...others, this.guardianPerson];
  }

  private addNeighbors(town: Town): void {
    const replies = [phrases.replyHello, phrases.replyGoodDay];
    const added = neighbors.map(({ member, route, facing }, index) => {
      const character = this.addPerson(member);
      const start = route[0] ?? { x: 0, z: 0 };
      character.placeAt(
        new THREE.Vector3(start.x, town.shape.heightAt(start.x, start.z), start.z),
        facing,
      );
      return {
        character,
        reply: replies[index % replies.length] ?? phrases.replyHello,
        route,
        routine: startRoutine,
      };
    });
    this.people = [...this.people, ...added];
  }

  /** Daily life goes on around the child, and nobody walks through anybody. */
  private updatePeople(dt: number, player: Player, ground: Ground): void {
    for (const person of this.people) {
      const { character, route, routine } = person;
      if (route === undefined || routine === undefined) {
        character.update(dt, still, false, ground);
        continue;
      }
      const step = stepRoutine(routine, route, character.position, player.position, dt, (curb) =>
        this.mayCross(curb),
      );
      person.routine = step.routine;
      if (step.lookAtChild) character.faceTowards(player.position);
      if (step.wave) character.playEmote('Wave');
      character.update(dt, step.walk, false, ground);
      const pushed = resolveCollisions(player.position, PERSON_SPACE, [
        colliderOf(character.position.x, character.position.z),
      ]);
      player.position.x = pushed.x;
      player.position.z = pushed.z;
    }
  }

  private mayCross(curb: Spot): boolean {
    return this.gameWorld?.outside?.mayCross(curb) ?? true;
  }

  private updateExploration(position: THREE.Vector3, input: Input, world: GameWorld): void {
    const gesture = this.gestureNow(position, world);
    this.controls.setGesture(gesture);
    this.padHints.setGesture(gesture);
    const nearby = this.nearbyPlace(position);
    if (nearby === undefined) this.controls.hideAction();
    else this.controls.showAction(nearby.icon, nearby.label);

    if (this.destination !== undefined) {
      const reached =
        Math.hypot(
          this.destination.position.x - position.x,
          this.destination.position.z - position.z,
        ) < this.destination.radius;
      if (reached) {
        this.say(phrases.arrived(this.destination.name));
        this.destination = undefined;
        this.showMarker();
      }
    }
    if (input.consumeAction() && nearby !== undefined) void this.use(nearby);
  }

  private nearbyPlace(position: THREE.Vector3): Interactable | undefined {
    let closest: Interactable | undefined;
    let best = Infinity;
    for (const place of this.gameWorld?.places ?? []) {
      const distance = Math.hypot(place.position.x - position.x, place.position.z - position.z);
      if (distance < place.radius && distance < best) {
        best = distance;
        closest = place;
      }
    }
    return closest;
  }

  private async use(place: Interactable): Promise<void> {
    await this.rewardSafeTrip();
    const task = this.home.errand;
    if (task?.stage === 'shop') {
      if (place.id === CityPlace.market && !isBakeryRun(task)) {
        this.sound('open');
        await this.errands.enterMarket();
        return;
      }
      if (place.id === CityPlace.bakery && isBakeryRun(task)) {
        this.sound('open');
        await this.errands.orderAtBakery();
        return;
      }
    }
    if (await this.errands.useInMarket(place.id)) return;
    if (await this.schoolDay.use(place.id)) return;
    const missionId = Object.entries(missionPlaces).find(
      ([, placeId]) => placeId === place.id,
    )?.[0];
    if (missionId !== undefined) {
      this.sound('open');
      await this.missions.open(missionId);
      return;
    }
    const thing = thingOf(place.id);
    if (thing !== undefined) {
      this.sound('open');
      await this.home.use(thing);
      return;
    }
    if (place.id === CityPlace.home) {
      this.sound('open');
      await this.home.comeHome();
      return;
    }
  }

  /** Runs `change` while a short, gentle fade covers the screen (never a sudden cut). */
  async transition(change: () => void): Promise<void> {
    const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    this.fade.classList.add('is-on');
    this.input?.reset();
    await wait(450);
    change();
    if (this.character !== undefined) this.mascot.placeNear(this.character.position);
    await wait(150);
    this.fade.classList.remove('is-on');
  }

  /** Another character in the scene (the cashier, for example). */
  whileLoading<T>(work: Promise<T>): Promise<T> {
    return this.loading.during(work);
  }

  addPerson(member: CastMember): Player {
    const character = this.avatars.createPerson(cast[member]);
    this.scene.add(character.root);
    return character;
  }

  /** Dev only: rows of the cast or outfits in front of the camera, for checking them by eye. */
  private showPeople(rows: readonly (readonly [string, Emote?, number?, Expression?])[]): void {
    const start = this.character?.position;
    if (start === undefined) return;
    rows.forEach(([who, emote, time, expression], index) => {
      const person =
        who in cast ? cast[who as CastMember] : childPerson(this.profile.look, who as OutfitId);
      const shown = this.avatars.createPerson(person);
      const x = start.x + (index - (rows.length - 1) / 2) * 1.5;
      shown.placeAt(new THREE.Vector3(x, start.y, start.z - 3), 0);
      this.scene.add(shown.root);
      this.people = [...this.people, { character: shown, reply: '' }];
      if (emote !== undefined) shown.playEmote(emote);
      if (time !== undefined) shown.freezeAt(time);
      if (expression !== undefined) shown.feel(expression);
    });
  }

  // ---------- Goal arrow ----------

  private goalPlace(): Interactable | undefined {
    if (this.destination !== undefined) return this.destination;
    const world = this.gameWorld;
    const task =
      world?.indoors === true
        ? undefined
        : (this.errands.goalPlaceId ?? this.schoolDay.goalPlaceId);
    if (task !== undefined) return world?.places.find((place) => place.id === task);
    if (world?.indoors === true) {
      return world.places.find((place) => place.id === this.home.goalPlaceId);
    }
    if (this.home.step !== 'outside') return world?.street;
    const placeId =
      this.goal.kind === 'mission'
        ? missionPlaces[this.goal.missionId]
        : this.goal.kind === 'wardrobe'
          ? CityPlace.home
          : undefined;
    return this.gameWorld?.places.find((p) => p.id === placeId);
  }

  /** The street as the child hears it and as the cars see it. */
  private watchTheStreet(player: Player, world: GameWorld): void {
    const town = world.outside;
    if (town === undefined || world.indoors) return;
    town.people = this.people
      .filter((person) => person.route !== undefined)
      .map((person) => person.character.position);
    const calm = this.currentSettings.worldActivity === 'calm';
    const noise = town.streetNoise(player.position);
    this.services.audio.setStreet(calm ? noise * CALM_STREET : noise);
    if (calm || this.elapsed < this.nextHorn) return;
    this.nextHorn = this.elapsed + HORN_EVERY + Math.random() * HORN_EVERY;
    if (noise > 0 && noise < 0.6) this.sound('horn');
  }

  private showMarker(): void {
    const place = this.goalPlace();
    if (place === undefined) this.marker.hide();
    else this.marker.show(place.markerPosition, place.position);
    if (this.currentMode !== 'explore') this.marker.group.visible = false;
  }

  /** Near the child's feet, where a far-away arrow could never be missed. */
  private showGuide(player: Player, world: GameWorld, exploring: boolean): void {
    if (exploring && !world.indoors) this.guide.update(player.position, this.goalPlace()?.position);
    else this.guide.hide();
  }

  private goalMessage(): string {
    if (this.gameWorld?.indoors === true) return this.home.tip ?? phrases.backHome;
    switch (this.goal.kind) {
      case 'mission': {
        const placeId = missionPlaces[this.goal.missionId];
        const name =
          this.gameWorld?.places.find((p) => p.id === placeId)?.name ?? 'a próxima missão';
        return this.goal.isNew ? phrases.goToMission(name) : phrases.backToMission(name);
      }
      case 'wardrobe':
        return 'Você tem moedas! Vamos ao guarda-roupa na sua casa?';
      case 'explore':
        return 'Vamos explorar a ilha!';
    }
  }

  // ---------- Session: autosave and time limit ----------

  private trackSession(dt: number): void {
    const playing = this.currentMode !== 'menu' && this.currentMode !== 'rest' && !document.hidden;
    if (playing) this.playedMs += dt * 1000;

    if (this.elapsed * 1000 - this.lastSave > AUTOSAVE_MS) {
      this.lastSave = this.elapsed * 1000;
      void this.saveSession();
    }
    if (this.elapsed * 1000 - this.lastTimeCheck > TIME_CHECK_MS) {
      this.lastTimeCheck = this.elapsed * 1000;
      void this.checkTime();
    }
  }

  private async checkTime(): Promise<void> {
    if (this.playerServices === undefined) return;
    const status = await this.playerServices.checkSessionTime.execute(
      this.playedMs,
      this.missions.isRunning,
    );
    switch (status.kind) {
      case 'free':
        this.hud.setTimeLeft(undefined, false);
        return;
      case 'counting':
        this.hud.setTimeLeft(status.minutesLeft, false);
        return;
      case 'last-mission':
        this.hud.setTimeLeft(status.minutesLeft, true);
        if (!this.warnedLastMission && this.currentMode === 'explore') {
          this.warnedLastMission = true;
          this.say(phrases.lastMission);
        }
        return;
      case 'time-to-rest':
        this.hud.setTimeLeft(0, true);
        if (this.currentMode === 'explore') {
          await this.saveSession();
          this.services.audio.stopMusic();
          this.enterPanel('rest');
          this.restScreen.open(this.profile.name);
          this.say(phrases.rest(this.profile.name));
        }
        return;
    }
  }

  private async saveSession(): Promise<void> {
    if (this.playerServices === undefined || this.character === undefined) return;
    const { position, facing } = this.character;
    await this.playerServices.saveSession.execute({
      x: position.x,
      y: position.y,
      z: position.z,
      facing,
      cameraYaw: this.cameraRig?.yaw ?? 0,
    });
  }

  private listenToPage(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.services.speech.stop();
        this.services.audio.stopMusic();
        void this.saveSession();
      } else if (!['loading', 'profiles', 'rest'].includes(this.currentMode)) {
        this.services.audio.startMusic();
      }
    });
    this.deviceReducedMotion.addEventListener('change', () => {
      this.applySettings(this.currentSettings);
    });
    window.addEventListener('pagehide', () => {
      void this.saveSession();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.goBack();
      if (isTyping(event.target) || event.repeat) return;
      const key = gameKey(event.code);
      if (key === 'pause') this.togglePause();
      if (this.currentMode !== 'explore') return;
      if (key === 'menu') this.goBack();
      if (key === 'agenda') {
        event.preventDefault();
        this.home.openAgenda();
      }
    });
    window.addEventListener('pointerdown', () => {
      this.showPadControls(false);
    });
  }

  /** Dev-only shortcuts for testing on a desktop (never included in production builds). */
  private exposeDevTools(): void {
    Object.assign(window, {
      lilo: {
        drill: async (skillId: string) => {
          const lines = await this.player.planSession.overview();
          const skill = lines.find((line) => line.skill.id === skillId)?.skill;
          if (skill === undefined) return;
          await this.learning.openPlanned(
            { skill, role: 'play', length: 3, isNew: false },
            () => undefined,
          );
        },
        goTo: (placeId: string) => {
          const place = this.gameWorld?.places.find((p) => p.id === placeId);
          if (place !== undefined) this.character?.placeAt(place.position, 0);
          return place !== undefined;
        },
        teleport: (x: number, z: number, yaw?: number) => {
          const world = this.gameWorld;
          if (world === undefined) return false;
          this.character?.placeAt(new THREE.Vector3(x, world.heightAt(x, z), z), 0);
          if (yaw !== undefined && this.cameraRig !== undefined) this.cameraRig.yaw = yaw;
          return world.isWalkable(x, z);
        },
        scene: this.scene,
        where: () => {
          const position = this.character?.position;
          return position === undefined
            ? undefined
            : { x: position.x, y: position.y, z: position.z };
        },
        use: (placeId: string) => {
          const place = this.gameWorld?.places.find((p) => p.id === placeId);
          if (place !== undefined) void this.use(place);
        },
        people: (rows: readonly (readonly [string, Emote?, number?, Expression?])[]) => {
          this.showPeople(rows);
        },
        look: (from: readonly [number, number, number], at: readonly [number, number, number]) => {
          this.rig.setFocus(new THREE.Vector3(...from), new THREE.Vector3(...at), true);
        },
        stats: () => {
          const { render, memory } = this.renderer?.info ?? { render: {}, memory: {} };
          return { ...render, ...memory, quality: this.governor.quality, fps: this.fps };
        },
        step: () => this.home.step,
        moment: (phase: Phase, weather: Weather) => {
          this.world.setMoment(phase, weather);
          this.world.sky.setLook(skyLook(phase, weather), true);
          this.character?.setPosture(comfortIn(weather, this.profile.outfit));
        },
        skipBlock: async () => {
          await this.player.followDay.skipBlock();
          await this.home.begin(false, this.avatar.position.clone());
        },
        addPlayTime: (minutes: number) => {
          this.playedMs += minutes * 60_000;
          this.lastTimeCheck = 0;
        },
      },
    });
  }
}
