import * as THREE from 'three';
import type { GameServices } from '@application/game-services';
import { phrases } from '@application/use-cases/choose-mission-answer';
import type { WardrobeEntry } from '@application/use-cases/get-wardrobe';
import type { WorldMap } from '@application/use-cases/get-world-map';
import type { Goal } from '@application/use-cases/suggest-next-goal';
import type { MissionAttempt } from '@domain/mission/mission-attempt';
import { Mascot } from '@presentation/actors/mascot';
import { Player } from '@presentation/actors/player';
import { CameraRig } from '@presentation/engine/camera-rig';
import { Input } from '@presentation/engine/input';
import { seededRandom } from '@presentation/engine/math';
import { cameraRelative } from '@presentation/engine/movement';
import { createRenderer, fitToContainer } from '@presentation/engine/renderer';
import { Controls } from '@presentation/ui/controls';
import { Dialog } from '@presentation/ui/dialog';
import { h } from '@presentation/ui/dom';
import { Hud } from '@presentation/ui/hud';
import { MissionPanel } from '@presentation/ui/mission-panel';
import { StartScreen } from '@presentation/ui/start-screen';
import { WardrobePanel } from '@presentation/ui/wardrobe-panel';
import { CityPlace } from '@presentation/world/city';
import { GameWorld } from '@presentation/world/game-world';
import { firstObstruction } from '@presentation/world/collision';
import { GoalMarker } from '@presentation/world/goal-marker';
import type { Interactable } from '@presentation/world/interactable';
import { portalId } from '@presentation/world/portals';
import '@presentation/ui/styles.css';

type Mode = 'loading' | 'explore' | 'mission' | 'wardrobe';

export interface GameAppOptions {
  readonly modelUrl: string;
  readonly seed?: number;
}

/** Where each mission happens in the open world. */
const missionPlaces: Readonly<Record<string, string>> = { 'city-market': CityPlace.market };

/**
 * Runs the 3D game. It only talks to the application layer through
 * GameServices, so rules (coins, hints, unlocks) stay out of rendering code.
 */
export class GameApp {
  private mode: Mode = 'loading';
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
  private readonly ui = h('div', { className: 'ui' });
  private readonly hud = new Hud();
  private readonly dialog = new Dialog();
  private readonly marker = new GoalMarker();
  private readonly mascot = new Mascot();
  private readonly controls: Controls;
  private readonly missionPanel: MissionPanel;
  private readonly wardrobePanel: WardrobePanel;

  private renderer?: THREE.WebGLRenderer;
  private world?: GameWorld;
  private player?: Player;
  private rig?: CameraRig;
  private input?: Input;
  private attempt?: MissionAttempt;
  private worldMap?: WorldMap;
  private goal: Goal = { kind: 'explore' };
  private busy = false;
  private lastTime = 0;
  private elapsed = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly services: GameServices,
    private readonly options: GameAppOptions,
  ) {
    this.controls = new Controls({
      onMove: (move) => this.input?.setJoystick(move),
      onJump: () => this.input?.requestJump(),
      onAction: () => this.input?.requestAction(),
    });
    this.missionPanel = new MissionPanel({
      onChoose: (choiceId) => void this.choose(choiceId),
      onExit: () => {
        this.backToExploring();
      },
      onReplay: () => {
        if (this.attempt !== undefined) void this.openMission(this.attempt.mission.id);
      },
    });
    this.wardrobePanel = new WardrobePanel({
      onSelect: (entry) => void this.selectItem(entry),
      onClose: () => {
        this.backToExploring();
      },
    });
  }

  async start(): Promise<void> {
    const startScreen = new StartScreen();
    this.ui.append(
      this.hud.element,
      this.dialog.element,
      this.controls.element,
      this.missionPanel.element,
      this.wardrobePanel.element,
    );
    this.root.append(this.ui, startScreen.element);

    try {
      const renderer = createRenderer(this.root);
      this.root.insertBefore(renderer.domElement, this.ui);
      this.renderer = renderer;
      fitToContainer(renderer, this.camera, this.root);
      window.addEventListener('resize', () => {
        fitToContainer(renderer, this.camera, this.root);
      });

      const world = new GameWorld(this.scene, seededRandom(this.options.seed ?? 20261028));
      this.world = world;
      const player = await Player.load(this.options.modelUrl);
      this.player = player;
      player.placeAt(world.spawn, Math.PI / 2);
      this.mascot.placeNear(world.spawn);
      this.scene.add(player.root, this.mascot.root, this.marker.group);

      this.rig = new CameraRig(
        this.camera,
        (x, z) => world.heightAt(x, z),
        (from, to) => firstObstruction(from, to, world.colliders),
      );
      this.rig.yaw = world.spawnYaw;
      this.rig.snapTo(player.position);
      this.input = new Input(renderer.domElement);
      this.controls.setVisible(false);

      await this.refresh();
      renderer.compile(this.scene, this.camera);
      renderer.setAnimationLoop((time) => {
        this.frame(time);
      });

      await startScreen.waitForPlay();
      this.mode = 'explore';
      this.controls.setVisible(true);
      this.say(`Oi! Eu sou o Lilo. ${this.goalMessage()}`);
      if (import.meta.env.DEV) this.exposeDevTools();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.services.speech.stop();
      });
    } catch (error) {
      console.error(error);
      startScreen.fail('Não foi possível abrir o jogo. Tente recarregar a página.');
    }
  }

  private frame(timeMs: number): void {
    const { renderer, world, player, rig, input } = this;
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

    const exploring = this.mode === 'explore';
    const look = input.consumeLook();
    if (exploring) rig.rotate(look.x, look.y);

    const move = exploring ? input.move : { x: 0, y: 0, running: false };
    if (exploring && input.consumeJump()) player.jump();
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
      const nearby = this.nearbyPlace(player.position);
      if (nearby === undefined) this.controls.hideAction();
      else this.controls.showAction(nearby.icon, nearby.label);
      if (input.consumeAction() && nearby !== undefined) void this.use(nearby);
    }

    renderer.render(this.scene, this.camera);
  }

  private nearbyPlace(position: THREE.Vector3): Interactable | undefined {
    let closest: Interactable | undefined;
    let best = Infinity;
    for (const place of this.world?.places ?? []) {
      const distance = Math.hypot(place.position.x - position.x, place.position.z - position.z);
      if (distance < place.radius && distance < best) {
        best = distance;
        closest = place;
      }
    }
    return closest;
  }

  private async use(place: Interactable): Promise<void> {
    if (place.id === CityPlace.market) {
      await this.openMission('city-market');
      return;
    }
    if (place.id === CityPlace.home) {
      await this.openWardrobe();
      return;
    }
    if (place.id === CityPlace.bakery) {
      this.say('A padaria abre em breve! Lá você vai pedir um lanche.');
      return;
    }
    if (place.id === CityPlace.busStop) {
      this.say('O ônibus vai sair em breve. Essa missão está chegando!');
      return;
    }
    const portal = this.worldMap?.worlds.find((entry) => portalId(entry.world.id) === place.id);
    if (portal === undefined) return;
    if (!portal.unlocked) {
      const plural = portal.starsMissing === 1 ? 'estrela' : 'estrelas';
      this.say(`Ganhe mais ${portal.starsMissing} ${plural} para abrir ${portal.world.name}.`);
    } else {
      this.say(`${portal.world.name} ainda está sendo construído!`);
    }
  }

  // ---------- Missions ----------

  private async openMission(missionId: string): Promise<void> {
    const result = await this.services.startMission.execute(missionId);
    if (!result.ok) {
      this.say('Essa missão ainda não está pronta.');
      return;
    }
    this.attempt = result.value;
    this.enterPanelMode('mission');

    const place = this.world?.places.find((p) => p.id === missionPlaces[missionId]);
    if (place !== undefined && this.player !== undefined && this.rig !== undefined) {
      this.player.placeAt(place.position, 0);
      const { x, y, z } = place.position;
      this.rig.setFocus(
        new THREE.Vector3(x - 3, y + 3.4, z - 8),
        new THREE.Vector3(x, y + 2.2, z + 3),
      );
    }
    this.missionPanel.open(this.attempt);
    const { mission } = this.attempt;
    this.dialog.say(`${mission.introduction} ${this.attempt.currentStep?.prompt ?? ''}`);
  }

  private async choose(choiceId: string): Promise<void> {
    if (this.busy || this.attempt === undefined) return;
    this.busy = true;
    try {
      const result = await this.services.chooseMissionAnswer.execute(this.attempt, choiceId);
      if (!result.ok) return;
      this.attempt = result.value.attempt;
      const { outcome } = result.value;

      switch (outcome.kind) {
        case 'hint':
          this.missionPanel.showHint(outcome.step.targetId, outcome.hintLevel);
          this.dialog.say(`${phrases.hint} ${outcome.step.prompt}`);
          break;
        case 'correct':
          this.missionPanel.collect(choiceId, outcome.nextStep.targetId);
          this.dialog.say(`${phrases.correct} ${outcome.nextStep.prompt}`);
          this.player?.playEmote('Yes');
          break;
        case 'completed':
          this.missionPanel.collect(choiceId);
          this.missionPanel.celebrate(result.value.reward ?? { coins: 0, stars: 0 });
          this.dialog.say(phrases.completed);
          this.player?.playEmote('Dance');
          await this.refresh();
          break;
      }
    } finally {
      this.busy = false;
    }
  }

  // ---------- Wardrobe ----------

  private async openWardrobe(): Promise<void> {
    this.enterPanelMode('wardrobe');
    const wardrobe = await this.services.getWardrobe.execute();
    this.wardrobePanel.open(wardrobe);

    if (this.player !== undefined && this.rig !== undefined) {
      const { x, y, z } = this.player.position;
      const cameraPosition = new THREE.Vector3(x - 0.6, y + 1.7, z - 4.2);
      this.player.faceTowards(cameraPosition);
      this.rig.setFocus(cameraPosition, new THREE.Vector3(x - 1.3, y + 1.1, z));
      this.player.playEmote('Wave');
    }
    this.say('Escolha uma roupa!');
  }

  private async selectItem(entry: WardrobeEntry): Promise<void> {
    if (!entry.owned && !entry.affordable) {
      const { coins } = await this.services.getWardrobe.execute();
      const missing = entry.item.price - coins;
      this.say(`Faltam ${missing} moedas. Vamos ao mercado ganhar mais?`);
      return;
    }

    const result = entry.owned
      ? await this.services.toggleWardrobeItem.execute(entry.item.id)
      : await this.services.buyWardrobeItem.execute(entry.item.id);
    if (!result.ok) return;

    await this.refresh();
    this.wardrobePanel.show(await this.services.getWardrobe.execute());
    this.player?.playEmote(entry.owned ? 'Yes' : 'ThumbsUp');
    this.say(entry.owned ? entry.item.name : `${entry.item.name}! Ficou ótimo!`);
  }

  // ---------- Shared ----------

  private enterPanelMode(mode: 'mission' | 'wardrobe'): void {
    this.mode = mode;
    this.controls.setVisible(false);
    this.controls.hideAction();
    this.marker.group.visible = false;
    if (this.input !== undefined) this.input.enabled = false;
  }

  private backToExploring(): void {
    this.missionPanel.close();
    this.wardrobePanel.close();
    this.services.speech.stop();
    this.rig?.clearFocus();
    this.mode = 'explore';
    this.controls.setVisible(true);
    if (this.input !== undefined) this.input.enabled = true;
    void this.refresh().then(() => {
      this.say(this.goalMessage());
    });
  }

  /** Reloads progress and updates everything that depends on it. */
  private async refresh(): Promise<void> {
    const [progress, wardrobe, worldMap, goal] = await Promise.all([
      this.services.getPlayerProgress.execute(),
      this.services.getWardrobe.execute(),
      this.services.getWorldMap.execute(),
      this.services.suggestNextGoal.execute(),
    ]);
    this.hud.set(progress.coins.amount, progress.stars);
    this.player?.dress(
      progress.equipped,
      wardrobe.entries.map((entry) => entry.item),
    );

    if (this.worldMap?.stars !== worldMap.stars) this.world?.showWorlds(worldMap.worlds);
    this.worldMap = worldMap;

    this.goal = goal;
    const placeId =
      goal.kind === 'mission'
        ? missionPlaces[goal.missionId]
        : goal.kind === 'wardrobe'
          ? CityPlace.home
          : undefined;
    const place = this.world?.places.find((p) => p.id === placeId);
    if (place === undefined) this.marker.hide();
    else this.marker.show(place.markerPosition, place.position);
    if (this.mode === 'mission' || this.mode === 'wardrobe') this.marker.group.visible = false;
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

  /** Dev-only shortcuts for testing on a desktop (never included in production builds). */
  private exposeDevTools(): void {
    Object.assign(window, {
      lilo: {
        goTo: (placeId: string) => {
          const place = this.world?.places.find((p) => p.id === placeId);
          if (place !== undefined) this.player?.placeAt(place.position, 0);
          return place !== undefined;
        },
        use: (placeId: string) => {
          const place = this.world?.places.find((p) => p.id === placeId);
          if (place !== undefined) void this.use(place);
        },
      },
    });
  }

  private say(message: string): void {
    this.dialog.say(message);
    void this.services.speech.speak(message);
  }
}
