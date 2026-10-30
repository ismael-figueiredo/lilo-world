import * as THREE from 'three';
import { phrases } from '@application/phrases';
import type { GameServices, PlayerServices } from '@application/game-services';
import type { SoundEffect } from '@application/ports/audio';
import type { WorldMap } from '@application/use-cases/get-world-map';
import type { Goal } from '@application/use-cases/suggest-next-goal';
import { DEFAULT_AVATAR_ID, type PlayerProfile } from '@domain/profile/player-profile';
import { sessionTimeStatus } from '@domain/session/session';
import { defaultSettings, type Settings } from '@domain/settings/settings';
import { Mascot } from '@presentation/actors/mascot';
import { AvatarLibrary } from '@presentation/actors/avatar-library';
import { avatarPictureUrl } from '@presentation/actors/avatar-rigs';
import type { Player } from '@presentation/actors/player';
import { MenuController } from '@presentation/controllers/menu-controller';
import { ActivityController } from '@presentation/controllers/activity-controller';
import { MissionController, missionPlaces } from '@presentation/controllers/mission-controller';
import { SessionController } from '@presentation/controllers/session-controller';
import { WardrobeController } from '@presentation/controllers/wardrobe-controller';
import { CameraRig } from '@presentation/engine/camera-rig';
import { GamepadReader, padIsActive } from '@presentation/engine/gamepad';
import { gameKey, Input, isTyping } from '@presentation/engine/input';
import { seededRandom } from '@presentation/engine/math';
import { cameraRelative } from '@presentation/engine/movement';
import { createRenderer, fitToContainer } from '@presentation/engine/renderer';
import type { GameContext, Mode, PanelMode } from '@presentation/game-context';
import { Controls } from '@presentation/ui/controls';
import { Dialog } from '@presentation/ui/dialog';
import { h } from '@presentation/ui/dom';
import { Hud } from '@presentation/ui/hud';
import { Minimap } from '@presentation/ui/minimap';
import type { Gesture } from '@presentation/ui/controls';
import { CalmPause } from '@presentation/ui/calm-pause';
import { PadFocus } from '@presentation/ui/pad-focus';
import {
  colliderOf,
  nearestPerson,
  neighborSpots,
  standingGround,
  type Person,
} from '@presentation/world/neighbors';
import { PadHints } from '@presentation/ui/pad-hints';
import { ProfileScreen } from '@presentation/ui/profile-screen';
import { RestScreen } from '@presentation/ui/rest-screen';
import { CityPlace } from '@presentation/world/city';
import { firstObstruction } from '@presentation/world/collision';
import { GameWorld } from '@presentation/world/game-world';
import { GoalMarker } from '@presentation/world/goal-marker';
import type { Interactable } from '@presentation/world/interactable';
import { captureMap } from '@presentation/world/map-snapshot';
import { emotionsArrival, EmotionsPlace } from '@presentation/world/emotions-garden';
import { homeArrival, HomePlace } from '@presentation/world/home-area';
import { campArrival, NaturePlace } from '@presentation/world/nature-camp';
import { schoolArrival, SchoolPlace } from '@presentation/world/school-area';
import { PORTAL_PLAZA, portalId } from '@presentation/world/portals';
import type { RoadEvent } from '@presentation/world/road-safety';
import { skillOfStation } from '@presentation/world/stations';
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
/** Seconds between greetings: one wave at a time, even if the button is pressed again. */
const GREET_GAP = 2.5;
const still = { x: 0, z: 0 };
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
  private readonly mascot = new Mascot();
  private readonly minimap = new Minimap(() => {
    if (this.currentMode === 'explore') this.menus.openMap();
  });
  private readonly controls: Controls;
  private readonly profileScreen: ProfileScreen;
  private readonly restScreen: RestScreen;
  private readonly missions: MissionController;
  private readonly learning: ActivityController;
  private readonly day: SessionController;
  private readonly wardrobe: WardrobeController;
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
  private worldMap: WorldMap | undefined;
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
  private people: readonly Person[] = [];

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
        if (this.currentMode === 'explore') this.day.open();
      },
      onAction: () => this.input?.requestAction(),
    });
    this.profileScreen = new ProfileScreen({
      onSelect: (profile) => void this.selectProfile(profile),
      onCreate: (name, avatarId) => void this.createProfile(name, avatarId),
      onPreviewAvatar: (avatarId) => {
        this.avatars.preload(avatarId);
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
      this.input.reset();
    }
  }

  backToExploring(message?: string): void {
    this.services.speech.stop();
    this.ui.classList.remove('has-panel');
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.cameraRig?.clearFocus();
    this.currentMode = 'explore';
    this.controls.setVisible(true);
    this.minimap.setVisible(this.currentSettings.showMinimap);
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
    const [progress, wardrobe, worldMap, goal] = await Promise.all([
      player.getPlayerProgress.execute(),
      player.getWardrobe.execute(),
      player.getWorldMap.execute(),
      player.suggestNextGoal.execute(),
    ]);
    this.hud.set(progress.coins.amount, progress.stars);
    this.character?.dress(
      progress.equipped,
      wardrobe.entries.map((entry) => entry.item),
    );
    if (this.worldMap?.stars !== worldMap.stars) this.gameWorld?.showWorlds(worldMap.worlds);
    this.worldMap = worldMap;
    this.goal = goal;
    this.showMarker();
  }

  applySettings(settings: Settings): void {
    this.currentSettings = settings;
    if (this.renderer !== undefined) {
      this.renderer.domElement.style.filter = settings.softColors
        ? 'saturate(0.68) brightness(1.03)'
        : '';
    }
    this.root.classList.toggle('reduce-motion', settings.reducedMotion);
    // The device setting counts too: CSS follows it by itself, the 3D world does not.
    const motion = settings.reducedMotion || this.deviceReducedMotion.matches ? 0.3 : 1;
    this.gameWorld?.setMotionScale(motion);
    this.mascot.motionScale = motion;
    this.marker.motionScale = motion;
    if (this.cameraRig !== undefined) {
      this.cameraRig.sensitivity = cameraSpeeds[settings.cameraSensitivity];
    }
    this.minimap.setVisible(settings.showMinimap && this.currentMode === 'explore');
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
    await this.useAvatar(avatarId);
    await this.refresh();
  }

  avatarPicture(avatarId: string): string {
    return avatarPictureUrl(this.options.baseUrl, avatarId);
  }

  /** Replaces the 3D character in place (same spot, same direction). */
  private async useAvatar(avatarId: string): Promise<void> {
    if (this.character?.avatarId === avatarId) return;
    const next = await this.avatars.create(avatarId);
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
      this.day.board.element,
      this.wardrobe.panel.element,
      ...this.menus.elements,
      this.restScreen.element,
      this.calmPause.element,
      this.padHints.element,
      this.fade,
    );
    this.root.append(this.ui, this.profileScreen.element);
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

      const assets = await WorldAssets.load(this.options.baseUrl);
      const world = new GameWorld(this.scene, seededRandom(this.options.seed ?? 20261028), assets);
      this.gameWorld = world;
      const player = await this.avatars.create(DEFAULT_AVATAR_ID);
      this.character = player;
      player.placeAt(world.spawn, Math.PI / 2);
      this.mascot.placeNear(world.spawn);
      this.scene.add(player.root, this.mascot.root, this.marker.group);

      this.cameraRig = new CameraRig(
        this.camera,
        (x, z) => world.heightAt(x, z),
        (from, to) => firstObstruction(from, to, world.colliders),
      );
      this.cameraRig.yaw = world.spawnYaw;
      this.cameraRig.snapTo(player.position);
      void this.addNeighbors(world);
      this.input = new Input(renderer.domElement);
      this.enterPanel('menu');
      this.currentMode = 'profiles';

      renderer.compile(this.scene, this.camera);
      renderer.setAnimationLoop((time) => {
        this.frame(time);
      });
      this.listenToPage();
      if (import.meta.env.DEV) this.exposeDevTools();

      this.profileScreen.setAvatars(await this.services.listAvatars.execute(), (id) =>
        this.avatarPicture(id),
      );
      this.profileScreen.show(await this.services.listProfiles.execute());
    } catch (error) {
      console.error(error);
      this.profileScreen.setLoading('Não foi possível abrir o jogo. Tente recarregar a página.');
    }
  }

  // ---------- Profiles ----------

  private async selectProfile(profile: PlayerProfile): Promise<void> {
    const result = await this.services.selectProfile.execute(profile.id);
    if (result.ok) await this.beginProfile(result.value, false);
  }

  private async createProfile(name: string, avatarId: string): Promise<void> {
    const result = await this.services.createProfile.execute(name, avatarId);
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
    await this.useAvatar(profile.avatarId);
    this.applySettings(await this.player.applySettings.execute());

    const session = await this.player.loadSession.execute();
    const world = this.world;
    if (session !== undefined && world.isWalkable(session.x, session.z)) {
      this.avatar.placeAt(
        new THREE.Vector3(session.x, world.heightAt(session.x, session.z), session.z),
        session.facing,
      );
      this.rig.yaw = session.cameraYaw;
    } else {
      this.avatar.placeAt(world.spawn, Math.PI / 2);
      this.rig.yaw = world.spawnYaw;
    }
    this.rig.snapTo(this.avatar.position);
    this.mascot.placeNear(this.avatar.position);

    this.playedMs = 0;
    this.warnedLastMission = false;
    this.destination = undefined;
    this.worldMap = undefined;
    await this.refresh();

    // The start screen still covers the game, so this extra frame is never seen.
    const picture = captureMap(
      renderer,
      this.scene,
      [this.avatar.root, this.mascot.root, this.marker.group],
      (visible) => {
        world.setCloudsVisible(visible);
      },
    );
    this.menus.map.setPicture(picture);
    this.minimap.setPicture(picture);

    this.profileScreen.hide();
    this.services.audio.startMusic();
    this.backToExploringQuietly();
    this.say(isNew ? phrases.hello(profile.name) : phrases.welcomeBack(profile.name));
    await this.day.start();
  }

  private backToExploringQuietly(): void {
    this.ui.classList.remove('has-panel');
    this.cameraRig?.clearFocus();
    this.currentMode = 'explore';
    this.controls.setVisible(true);
    this.minimap.setVisible(this.currentSettings.showMinimap);
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

    const exploring = this.currentMode === 'explore';
    this.pollGamepad(dt, input, exploring);
    const look = input.consumeLook();
    if (exploring) rig.rotate(look.x, look.y);

    const move = exploring ? input.move : { x: 0, y: 0, running: false };
    if (exploring && input.consumeGesture()) this.gesture(player, world);
    player.update(dt, cameraRelative(move, rig.yaw), move.running, world);
    const standing = standingGround(world);
    for (const person of this.people) person.character.update(dt, still, false, standing);

    const cameraYaw = Math.atan2(
      this.camera.position.x - player.position.x,
      this.camera.position.z - player.position.z,
    );
    this.mascot.update(this.elapsed, dt, player.position, cameraYaw);
    this.marker.update(this.elapsed);
    world.update(this.elapsed, dt, player.position);
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
      if (pad.agenda) this.day.open();
      if (pad.pause) this.togglePause();
      return;
    }
    if (pad.pause) this.togglePause();
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
    if (this.currentMode === 'pause') this.togglePause();
    else if (this.currentMode === 'explore') this.menus.open();
    else if (this.currentMode === 'menu') {
      this.menus.closeAll();
      this.backToExploring();
    } else if (this.currentMode === 'wardrobe') {
      this.wardrobe.close();
      this.backToExploring();
    } else if (this.currentMode === 'mission') void this.missions.exit();
    else if (this.currentMode === 'learning') this.learning.exit();
    else if (this.currentMode === 'session') this.day.later();
  }

  /** Calm street rules: a warning brings the child back, and safe trips earn coins. */
  private watchTheRoad(position: THREE.Vector3, world: GameWorld): void {
    if (this.missions.isCrossingStreet || this.returningToSidewalk) return;
    const event = world.roadSafety.update(position.x, position.z, world.trafficPhase.walk);
    if (event === 'crossed') {
      this.safeTrip = true;
    } else if (event !== undefined) {
      this.safeTrip = false;
      void this.backToSidewalk(event, world);
    }
  }

  private async backToSidewalk(event: RoadEvent, world: GameWorld): Promise<void> {
    const spot = world.roadSafety.lastSafeSpot;
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
      world.roadSafety.reset();
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

  /** Neighbors arrive after the world: nobody waits for them to start playing. */
  private async addNeighbors(world: GameWorld): Promise<void> {
    const replies = [phrases.replyHello, phrases.replyGoodDay];
    const people = await Promise.all(
      neighborSpots.map(async ({ avatarId, x, z, facing }, index) => {
        const character = await this.createCharacter(avatarId);
        character.placeAt(new THREE.Vector3(x, world.heightAt(x, z), z), facing);
        return { character, reply: replies[index % replies.length] ?? phrases.replyHello };
      }),
    );
    world.addColliders(neighborSpots.map(({ x, z }) => colliderOf(x, z)));
    this.people = people;
  }

  private updateExploration(position: THREE.Vector3, input: Input, world: GameWorld): void {
    const gesture = this.gestureNow(position, world);
    this.controls.setGesture(gesture);
    this.padHints.setGesture(gesture);
    const nearby = this.offeredPlace(position);
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

  /** On the way to a station, the others do not offer themselves along the road. */
  private offeredPlace(position: THREE.Vector3): Interactable | undefined {
    const nearby = this.nearbyPlace(position);
    const passing =
      this.destination !== undefined &&
      nearby !== this.destination &&
      nearby !== undefined &&
      skillOfStation(nearby.id) !== undefined;
    return passing ? undefined : nearby;
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
    const missionId = Object.entries(missionPlaces).find(
      ([, placeId]) => placeId === place.id,
    )?.[0];
    if (missionId !== undefined) {
      this.sound('open');
      await this.missions.open(missionId);
      return;
    }
    if (place.id === CityPlace.home) {
      this.sound('open');
      await this.wardrobe.open();
      return;
    }
    if (
      place.id === NaturePlace.back ||
      place.id === HomePlace.back ||
      place.id === SchoolPlace.back ||
      place.id === EmotionsPlace.back
    ) {
      this.sound('open');
      await this.travel(
        new THREE.Vector3(PORTAL_PLAZA.x, PORTAL_PLAZA.height, PORTAL_PLAZA.z + 7),
        0,
      );
      return;
    }
    const skill = skillOfStation(place.id);
    if (skill !== undefined) {
      this.sound('open');
      if (await this.day.arrive(skill)) return;
      await this.learning.open(skill);
      return;
    }

    const portal = this.worldMap?.worlds.find((entry) => portalId(entry.world.id) === place.id);
    if (portal === undefined) return;
    if (!portal.unlocked) {
      this.say(phrases.starsMissing(portal.starsMissing, portal.world.name));
    } else if (portal.world.id === 'nature') {
      this.sound('open');
      await this.travel(campArrival, Math.PI / 2);
      this.say(phrases.welcomeNature);
    } else if (portal.world.id === 'emotions') {
      this.sound('open');
      await this.travel(emotionsArrival, 0);
      this.say(phrases.welcomeEmotions);
    } else if (portal.world.id === 'school') {
      this.sound('open');
      await this.travel(schoolArrival, 0);
      this.say(phrases.welcomeSchool);
    } else if (portal.world.id === 'home') {
      this.sound('open');
      await this.travel(homeArrival, 0);
      this.say(phrases.welcomeHome);
    } else {
      this.say(phrases.worldNotReady(portal.world.name));
    }
  }

  /** Moves the child far away behind a short, gentle fade (never a sudden cut). */
  private async travel(to: THREE.Vector3, yaw: number): Promise<void> {
    await this.transition(() => {
      this.character?.placeAt(to, yaw + Math.PI);
      if (this.cameraRig !== undefined && this.character !== undefined) {
        this.cameraRig.yaw = yaw;
        this.cameraRig.snapTo(this.character.position);
      }
    });
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
  async createCharacter(avatarId: string): Promise<Player> {
    const character = await this.avatars.create(avatarId);
    this.scene.add(character.root);
    return character;
  }

  // ---------- Goal arrow ----------

  private goalPlace(): Interactable | undefined {
    if (this.destination !== undefined) return this.destination;
    const placeId =
      this.goal.kind === 'mission'
        ? missionPlaces[this.goal.missionId]
        : this.goal.kind === 'wardrobe'
          ? CityPlace.home
          : undefined;
    return this.gameWorld?.places.find((p) => p.id === placeId);
  }

  private showMarker(): void {
    const place = this.goalPlace();
    if (place === undefined) this.marker.hide();
    else this.marker.show(place.markerPosition, place.position);
    if (this.currentMode !== 'explore') this.marker.group.visible = false;
  }

  private goalMessage(): string {
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
        if (this.currentMode === 'explore' || this.currentMode === 'session') {
          await this.saveSession();
          this.day.close();
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
        this.day.open();
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
        addPlayTime: (minutes: number) => {
          this.playedMs += minutes * 60_000;
          this.lastTimeCheck = 0;
        },
      },
    });
  }
}
