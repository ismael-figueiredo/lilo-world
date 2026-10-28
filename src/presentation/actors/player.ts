import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { WardrobeItem, WardrobeItemId, WardrobeSlot } from '@domain/avatar/wardrobe-item';
import { dampAngle } from '@presentation/engine/math';
import { buildAccessory, type Anchor } from '@presentation/actors/wardrobe-meshes';
import { resolveCollisions, type Collider } from '@presentation/world/collision';

export type Emote = 'Wave' | 'Dance' | 'ThumbsUp' | 'Yes';
type Motion = 'Idle' | 'Walking' | 'Running' | 'Jump';

export interface Ground {
  heightAt(x: number, z: number): number;
  isWalkable(x: number, z: number): boolean;
  readonly colliders: readonly Collider[];
}

const HEIGHT = 1.9;
const RADIUS = 0.45;
const WALK_SPEED = 3.8;
const RUN_SPEED = 7.5;
const JUMP_SPEED = 7.2;
const GRAVITY = 21;
/** Bright starting colors, before the child picks their own. */
const DEFAULT_BODY = 0xffc93c;
const DEFAULT_TRIM = 0xdfe6ee;

/**
 * The child's character: an animated robot (CC0 model by Quaternius) with
 * swappable colors and accessories. Movement is kinematic and forgiving: it
 * climbs any hill, never falls into the sea and never "dies".
 */
export class Player {
  readonly root = new THREE.Group();
  facing = 0;
  speed = 0;

  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private current?: THREE.AnimationAction;
  private emote: Emote | null = null;
  private velocityY = 0;
  private grounded = true;
  private readonly anchors: Record<Anchor, THREE.Object3D>;
  private readonly headWidth: number;
  private readonly worn = new Map<WardrobeSlot, THREE.Object3D>();

  private constructor(
    model: THREE.Object3D,
    animations: readonly THREE.AnimationClip[],
    private readonly bodyMaterial: THREE.MeshStandardMaterial | undefined,
    private readonly trimMaterial: THREE.MeshStandardMaterial | undefined,
  ) {
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.mixer.addEventListener('finished', () => {
      this.emote = null;
    });

    const { anchors, headWidth } = createAnchors(this.root, model);
    this.anchors = anchors;
    this.headWidth = headWidth;
    this.play('Idle', 0);
  }

  static async load(url: string): Promise<Player> {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;

    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    model.scale.setScalar(HEIGHT / size.y);

    const materials = new Map<string, THREE.MeshStandardMaterial>();
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        const material = object.material as THREE.MeshStandardMaterial;
        material.flatShading = true;
        material.roughness = 0.55;
        material.metalness = 0;
        material.needsUpdate = true;
        materials.set(material.name, material);
      }
    });
    return new Player(model, gltf.animations, materials.get('Main'), materials.get('Grey'));
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  placeAt(position: THREE.Vector3, facing: number): void {
    this.root.position.copy(position);
    this.facing = facing;
    this.root.rotation.y = facing;
  }

  jump(): void {
    if (!this.grounded) return;
    this.velocityY = JUMP_SPEED;
    this.grounded = false;
    this.emote = null;
  }

  playEmote(emote: Emote): void {
    if (!this.actions.has(emote)) return;
    this.emote = emote;
    this.play(emote, 0.2, true);
  }

  faceTowards(target: THREE.Vector3): void {
    this.facing = Math.atan2(target.x - this.position.x, target.z - this.position.z);
  }

  /** `direction` is on the ground plane, length 0..1. */
  update(dt: number, direction: { x: number; z: number }, running: boolean, ground: Ground): void {
    const amount = Math.min(1, Math.hypot(direction.x, direction.z));
    const targetSpeed = amount * (running ? RUN_SPEED : WALK_SPEED);
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 10);

    if (amount > 0.05) {
      this.facing = dampAngle(this.facing, Math.atan2(direction.x, direction.z), 12, dt);
      this.emote = null;
      this.moveHorizontally(dt, direction, amount, ground);
    }
    this.root.rotation.y = dampAngle(this.root.rotation.y, this.facing, 14, dt);
    this.moveVertically(dt, ground);
    this.animate();
    this.mixer.update(dt);
  }

  /** Applies equipped wardrobe items to the character. */
  dress(
    equipped: Readonly<Partial<Record<WardrobeSlot, WardrobeItemId>>>,
    items: readonly WardrobeItem[],
  ): void {
    const itemIn = (slot: WardrobeSlot) => items.find((item) => item.id === equipped[slot]);

    this.bodyMaterial?.color.setHex(itemIn('body')?.color ?? DEFAULT_BODY);
    this.trimMaterial?.color.setHex(itemIn('trim')?.color ?? DEFAULT_TRIM);

    for (const slot of ['hat', 'accessory'] as const) {
      this.worn.get(slot)?.removeFromParent();
      this.worn.delete(slot);
      const item = itemIn(slot);
      const model = item === undefined ? undefined : buildAccessory(item.look, item.color);
      if (model === undefined) continue;
      model.object.scale.setScalar(this.headWidth);
      this.anchors[model.anchor].add(model.object);
      this.worn.set(slot, model.object);
    }
  }

  private moveHorizontally(
    dt: number,
    direction: { x: number; z: number },
    amount: number,
    ground: Ground,
  ): void {
    const step = (this.speed * dt) / amount;
    const from = this.root.position;
    const candidates = [
      { x: from.x + direction.x * step, z: from.z + direction.z * step },
      { x: from.x + direction.x * step, z: from.z },
      { x: from.x, z: from.z + direction.z * step },
    ];
    for (const candidate of candidates) {
      const resolved = resolveCollisions(candidate, RADIUS, ground.colliders);
      if (ground.isWalkable(resolved.x, resolved.z)) {
        from.x = resolved.x;
        from.z = resolved.z;
        return;
      }
    }
  }

  private moveVertically(dt: number, ground: Ground): void {
    const floor = ground.heightAt(this.root.position.x, this.root.position.z);
    if (this.grounded) {
      this.root.position.y = floor;
      return;
    }
    this.velocityY -= GRAVITY * dt;
    this.root.position.y += this.velocityY * dt;
    if (this.root.position.y <= floor) {
      this.root.position.y = floor;
      this.velocityY = 0;
      this.grounded = true;
    }
  }

  private animate(): void {
    if (!this.grounded) {
      this.play('Jump', 0.12, true);
      return;
    }
    if (this.emote !== null) return;
    const motion: Motion = this.speed > 5.2 ? 'Running' : this.speed > 0.3 ? 'Walking' : 'Idle';
    this.play(motion, 0.25);
    if (this.current !== undefined && motion !== 'Idle') {
      this.current.timeScale =
        motion === 'Running' ? this.speed / RUN_SPEED + 0.2 : this.speed / WALK_SPEED;
    }
  }

  private play(name: string, fade: number, once = false): void {
    const next = this.actions.get(name);
    if (next === undefined || next === this.current) return;
    next.reset();
    next.timeScale = 1;
    if (once) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
    }
    next.play();
    if (this.current !== undefined) next.crossFadeFrom(this.current, fade, true);
    this.current = next;
  }
}

/**
 * Creates empty objects glued to the head and torso bones, measured in the
 * rest pose, so accessories follow every animation with no manual math.
 */
function createAnchors(
  root: THREE.Object3D,
  model: THREE.Object3D,
): { anchors: Record<Anchor, THREE.Object3D>; headWidth: number } {
  // The root is still unplaced (identity), so world coordinates equal root coordinates.
  root.updateMatrixWorld(true);
  let headBone: THREE.Object3D | undefined;
  let torsoBone: THREE.Object3D | undefined;
  let headMesh: THREE.Object3D | undefined;
  let torsoMesh: THREE.Object3D | undefined;
  model.traverse((object) => {
    if (object instanceof THREE.Bone && object.name === 'Head') headBone ??= object;
    if (object instanceof THREE.Bone && object.name === 'Torso') torsoBone ??= object;
    if (object instanceof THREE.Mesh && object.name.startsWith('Head')) headMesh ??= object;
    if (object instanceof THREE.Mesh && object.name.startsWith('Torso')) torsoMesh ??= object;
  });

  const head = new THREE.Box3().setFromObject(headMesh ?? model);
  const headSize = head.getSize(new THREE.Vector3());
  const headCenter = head.getCenter(new THREE.Vector3());
  const torso = new THREE.Box3().setFromObject(torsoMesh ?? model);
  const torsoCenter = torso.getCenter(new THREE.Vector3());

  const anchorAt = (
    parent: THREE.Object3D | undefined,
    position: THREE.Vector3,
  ): THREE.Object3D => {
    const anchor = new THREE.Object3D();
    anchor.position.copy(position);
    root.add(anchor);
    anchor.updateMatrixWorld();
    // `attach` keeps the world transform, so the anchor sits exactly where measured.
    parent?.attach(anchor);
    return anchor;
  };

  return {
    headWidth: headSize.x,
    anchors: {
      'head-top': anchorAt(headBone, new THREE.Vector3(headCenter.x, head.max.y, headCenter.z)),
      face: anchorAt(
        headBone,
        new THREE.Vector3(headCenter.x, headCenter.y + headSize.y * 0.08, head.max.z + 0.02),
      ),
      back: anchorAt(torsoBone, new THREE.Vector3(torsoCenter.x, torsoCenter.y, torso.min.z)),
    },
  };
}
