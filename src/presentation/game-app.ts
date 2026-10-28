import * as THREE from 'three';
import type { GameServices, PlayerServices } from '@application/game-services';
import type { SoundEffect } from '@application/ports/audio';
import type { WorldMap } from '@application/use-cases/get-world-map';
import type { Goal } from '@application/use-cases/suggest-next-goal';
import { DEFAULT_AVATAR_ID, type PlayerProfile } from '@domain/profile/player-profile';
import { defaultSettings, type Settings } from '@domain/settings/settings';
import { Mascot } from '@presentation/actors/mascot';
import { AvatarLibrary } from '@presentation/actors/avatar-library';
import { avatarPictureUrl } from '@presentation/actors/avatar-rigs';
import type { Player } from '@presentation/actors/player';
import { MenuController } from '@presentation/controllers/menu-controller';
import { LearningController } from '@presentation/controllers/learning-controller';
import { MissionController, missionPlaces } from '@presentation/controllers/mission-controller';
import { WardrobeController } from '@presentation/controllers/wardrobe-controller';
import { CameraRig } from '@presentation/engine/camera-rig';
import { GamepadReader } from '@presentation/engine/gamepad';
import { Input } from '@presentation/engine/input';
import { seededRandom } from '@presentation/engine/math';
import { cameraRelative } from '@presentation/engine/movement';
import { createRenderer, fitToContainer } from '@presentation/engine/renderer';
import type { GameContext, Mode, PanelMode } from '@presentation/game-context';
import { Controls } from '@presentation/ui/controls';
import { Dialog } from '@presentation/ui/dialog';
import { h } from '@presentation/ui/dom';
import { Hud } from '@presentation/ui/hud';
import { Minimap } from '@presentation/ui/minimap';
import { moveFocus, pressFocused } from '@presentation/ui/pad-focus';
import { ProfileScreen } from '@presentation/ui/profile-screen';
import { RestScreen } from '@presentation/ui/rest-screen';
import { CityPlace } from '@presentation/world/city';
import { firstObstruction } from '@presentation/world/collision';
import { GameWorld } from '@presentation/world/game-world';
import { GoalMarker } from '@presentation/world/goal-marker';
import type { Interactable } from '@presentation/world/interactable';
import { captureMap } from '@presentation/world/map-snapshot';
import { homeArrival, HomePlace } from '@presentation/world/home-area';
import { campArrival, NaturePlace } from '@presentation/world/nature-camp';
import { schoolArrival, SchoolPlace } from '@presentation/world/school-area';
import { PORTAL_PLAZA, portalId } from '@presentation/world/portals';
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
  private readonly hud = new Hud(() => {
    if (this.currentMode === 'explore') this.menus.open();
  });
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
  private readonly learning: LearningController;
  private readonly wardrobe: WardrobeController;
  private readonly menus: MenuController;
  private readonly avatars: AvatarLibrary;
  private readonly gamepad = new GamepadReader((connected) => {
    this.input?.reset();
    this.say(connected ? '🎮 Controle conectado!' : 'O controle desligou.');
  });

  private renderer: THREE.WebGLRenderer | undefined;
  private gameWorld: GameWorld | undefined;
  private character: Player | undefined;
  private cameraRig: CameraRig | undefined;
  private input: Input | undefined;
  private activeProfile: PlayerProfile | undefined;
  private playerServices: PlayerServices | undefined;
  private currentSettings: Settings = defaultSettings;
  private worldMap: WorldMap | undefined;
  private goal: Goal = { kind: 'explore' };
  private destination: Interactable | undefined;
  private lastTime = 0;
  private elapsed = 0;
  private playedMs = 0;
  private lastSave = 0;
  private lastTimeCheck = 0;
  private warnedLastMission = false;

  constructor(
    private readonly root: HTMLElement,
    readonly services: GameServices,
    private readonly options: GameAppOptions,
  ) {
    this.controls = new Controls({
      onMove: (move) => this.input?.setJoystick(move),
      onJump: () => this.input?.requestJump(),
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
        this.backToExploring();
      },
    });
    this.avatars = new AvatarLibrary(options.baseUrl);
    this.missions = new MissionController(this);
    this.learning = new LearningController(this);
    this.wardrobe = new WardrobeController(this);
    this.menus = new MenuController(this, () => this.goalPlace()?.id);
  }

  // ---------- GameContext ----------

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
    this.controls.setVisible(false);
    this.controls.hideAction();
    this.marker.group.visible = false;
    this.minimap.setVisible(false);
    if (this.input !== undefined) {
      this.input.enabled = false;
      this.input.reset();
    }
  }

  backToExploring(): void {
    this.services.speech.stop();
    this.cameraRig?.clearFocus();
    this.currentMode = 'explore';
    this.controls.setVisible(true);
    this.minimap.setVisible(this.currentSettings.showMinimap);
    if (this.input !== undefined) {
      this.input.reset();
      this.input.enabled = true;
    }
    void this.refresh().then(() => {
      if (this.destination === undefined) this.say(this.goalMessage());
    });
  }

  say(message: string): void {
    this.dialog.say(message);
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
    const motion = settings.reducedMotion ? 0.3 : 1;
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
    this.missions.close();
    this.learning.close();
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
      this.wardrobe.panel.element,
      ...this.menus.elements,
      this.restScreen.element,
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
    this.say(
      isNew
        ? `Oi, ${profile.name}! Eu sou o Lilo. ${this.goalMessage()}`
        : `Que bom te ver, ${profile.name}! ${this.goalMessage()}`,
    );
  }

  private backToExploringQuietly(): void {
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
    if (exploring && input.consumeJump() && player.isGrounded) {
      player.jump();
      this.sound('jump');
    }
    player.update(dt, cameraRelative(move, rig.yaw), move.running, world);

    const cameraYaw = Math.atan2(
      this.camera.position.x - player.position.x,
      this.camera.position.z - player.position.z,
    );
    this.mascot.update(this.elapsed, dt, player.position, cameraYaw);
    this.marker.update(this.elapsed);
    world.update(this.elapsed, dt, player.position);
    rig.update(dt, player.position);

    if (exploring) {
      this.updateExploration(player.position, input);
      this.missions.update(player.position);
      const goal = this.goalPlace();
      this.minimap.draw(
        { x: player.position.x, z: player.position.z, facing: player.facing },
        goal === undefined
          ? undefined
          : { x: goal.position.x, z: goal.position.z, icon: goal.icon },
      );
    }
    if (this.activeProfile !== undefined && this.currentMode !== 'profiles') {
      this.trackSession(dt);
    }

    renderer.render(this.scene, this.camera);
  }

  /** Controller: plays the game while exploring, moves the focus in panels. */
  private pollGamepad(dt: number, input: Input, exploring: boolean): void {
    const pad = this.gamepad.poll();
    if (pad === undefined) return;
    if (exploring) {
      input.applyPad(pad, dt);
      if (pad.menu) this.goBack();
      return;
    }
    if (pad.navigate !== undefined || pad.confirm) document.body.classList.add('is-pad');
    if (pad.navigate !== undefined) moveFocus(this.ui, pad.navigate);
    if (pad.confirm) pressFocused(this.ui);
    if (pad.back || pad.menu) this.goBack();
  }

  /** Esc, or B / Start on a controller: opens the menu or closes what is open. */
  private goBack(): void {
    if (this.currentMode === 'explore') this.menus.open();
    else if (this.currentMode === 'menu') {
      this.menus.closeAll();
      this.backToExploring();
    } else if (this.currentMode === 'wardrobe') {
      this.wardrobe.close();
      this.backToExploring();
    } else if (this.currentMode === 'mission') void this.missions.exit();
    else if (this.currentMode === 'learning') this.learning.exit();
  }

  private updateExploration(position: THREE.Vector3, input: Input): void {
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
        this.say(`Você chegou: ${this.destination.name}!`);
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
      place.id === SchoolPlace.back
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
      await this.learning.open(skill);
      return;
    }

    const portal = this.worldMap?.worlds.find((entry) => portalId(entry.world.id) === place.id);
    if (portal === undefined) return;
    if (!portal.unlocked) {
      const plural = portal.starsMissing === 1 ? 'estrela' : 'estrelas';
      this.say(`Ganhe mais ${portal.starsMissing} ${plural} para abrir ${portal.world.name}.`);
    } else if (portal.world.id === 'nature') {
      this.sound('open');
      await this.travel(campArrival, Math.PI / 2);
      this.say('Bem-vindo à Natureza! Visite a fazenda, a horta e a reciclagem.');
    } else if (portal.world.id === 'school') {
      this.sound('open');
      await this.travel(schoolArrival, 0);
      this.say('Bem-vindo à Escola! Visite a sala de aula, a professora e o parque.');
    } else if (portal.world.id === 'home') {
      this.sound('open');
      await this.travel(homeArrival, 0);
      this.say('Bem-vindo à Casa! Vamos cuidar das nossas rotinas.');
    } else {
      this.say(`${portal.world.name} ainda está sendo construído!`);
    }
  }

  /** Moves the child far away behind a short, gentle fade (never a sudden cut). */
  private async travel(to: THREE.Vector3, yaw: number): Promise<void> {
    const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    this.fade.classList.add('is-on');
    this.input?.reset();
    await wait(450);
    this.character?.placeAt(to, yaw + Math.PI);
    if (this.cameraRig !== undefined && this.character !== undefined) {
      this.cameraRig.yaw = yaw;
      this.cameraRig.snapTo(this.character.position);
    }
    this.mascot.placeNear(to);
    await wait(150);
    this.fade.classList.remove('is-on');
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
      case 'mission':
        return this.goal.isNew
          ? 'Vamos ao mercado? Siga a seta amarela!'
          : 'Que tal ir ao mercado de novo e ganhar mais moedas?';
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
          this.say('Falta pouco! Mais uma missão e depois vamos descansar.');
        }
        return;
      case 'time-to-rest':
        this.hud.setTimeLeft(0, true);
        if (this.currentMode === 'explore') {
          await this.saveSession();
          this.enterPanel('rest');
          this.restScreen.open(this.profile.name);
          this.say(`Hora de descansar, ${this.profile.name}. Você brincou muito bem!`);
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
        void this.saveSession();
      }
    });
    window.addEventListener('pagehide', () => {
      void this.saveSession();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.goBack();
    });
    window.addEventListener('pointerdown', () => {
      document.body.classList.remove('is-pad');
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
