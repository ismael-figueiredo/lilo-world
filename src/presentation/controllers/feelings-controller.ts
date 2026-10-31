import * as THREE from 'three';
import { phrases } from '@application/phrases';
import type { Expression } from '@presentation/actors/child-figure';
import {
  feelingNames,
  feelingScenes,
  namingChoices,
  sceneOfDay,
  type Feeling,
  type FeelingScene,
} from '@domain/feelings/scenes';
import type { HomeController } from '@presentation/controllers/home-controller';
import type { Player } from '@presentation/actors/player';
import type { GameContext } from '@presentation/game-context';
import { pictureOf } from '@presentation/world/study-desk';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const BEAT_MS = 2600;
const FACE_GAP = 1.6;
const PROP_OFFSET = new THREE.Vector3(0.9, 0, -0.6);

/** The faces are the characters' own: there is no emoji here to learn by heart. */
const faces: Readonly<Record<Feeling, Expression>> = {
  happy: 'happy',
  sad: 'sad',
  angry: 'angry',
  scared: 'scared',
  surprised: 'surprised',
};

/**
 * See it happen, notice the body, name it, find what helps. Nothing here is a
 * test: no points, and every help shows what comes of it.
 */
export class FeelingsController {
  constructor(
    private readonly ctx: GameContext,
    private readonly home: HomeController,
  ) {}

  /** Today's scene, if an adult turned scenes on after the review. */
  async playToday(friend: Player | undefined, model: Player | undefined): Promise<void> {
    if (!this.ctx.settings.feelingScenes || friend === undefined || model === undefined) return;
    await this.play(sceneOfDay(this.home.dayNumber, feelingScenes), friend, model);
  }

  private async play(scene: FeelingScene, friend: Player, model: Player): Promise<void> {
    const { ctx } = this;
    ctx.enterPanel('home');
    friend.placeAt(ctx.avatar.position.clone().setX(ctx.avatar.position.x + FACE_GAP), 0);
    friend.faceTowards(ctx.avatar.position);
    // What the scene is about stands there, in the world, beside the friend.
    const thing = pictureOf({ pictogram: scene.prop });
    thing.scale.setScalar(2.4);
    thing.position.copy(friend.position).add(PROP_OFFSET);
    friend.root.parent?.add(thing);
    await this.watch(scene, friend);
    await this.name(scene, friend, model);
    await this.helpOut(scene, friend);
    thing.removeFromParent();
    friend.feel('calm');
    model.feel('calm');
  }

  /** It can be seen again as many times as the child wants. */
  private async watch(scene: FeelingScene, friend: Player): Promise<void> {
    const { ctx } = this;
    for (;;) {
      friend.feel('calm');
      ctx.say(scene.happens);
      await wait(BEAT_MS);
      friend.feel(faces[scene.feeling]);
      ctx.say(scene.body);
      await wait(BEAT_MS);
      const chosen = await this.home.sheet.choose(phrases.feelingSeen, [
        { id: 'again', icon: '🔁', label: 'Ver de novo' },
        { id: 'go', icon: '➡️', label: 'Continuar' },
      ]);
      if (chosen === 'go') return;
    }
  }

  /** Two real faces side by side, and no long sentence. */
  private async name(scene: FeelingScene, friend: Player, model: Player): Promise<void> {
    const { ctx } = this;
    model.placeAt(friend.position.clone().setZ(friend.position.z + FACE_GAP), 0);
    model.faceTowards(ctx.avatar.position);
    model.feel(faces[scene.other]);
    ctx.say(phrases.feelingAsk);
    const options = namingChoices(scene, Math.random).map((feeling) => ({
      id: feeling,
      icon: '👤',
      label: feelingNames[feeling],
    }));
    const chosen = await this.home.sheet.choose(phrases.feelingAsk, options);
    if (chosen !== scene.feeling) ctx.sound('hint');
    ctx.say(phrases.feelingWas(feelingNames[scene.feeling]));
    model.feel('calm');
    await wait(BEAT_MS);
  }

  private async helpOut(scene: FeelingScene, friend: Player): Promise<void> {
    const { ctx } = this;
    ctx.say(phrases.feelingHelp);
    const chosen = await this.home.sheet.choose(phrases.feelingHelp, scene.helps);
    const help = scene.helps.find((option) => option.id === chosen) ?? scene.helps[0];
    if (help === undefined) return;
    ctx.say(help.result);
    friend.feel(help.after === 'calm' ? 'calm' : faces[help.after]);
    await wait(BEAT_MS * 1.5);
  }
}
