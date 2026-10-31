import * as THREE from 'three';
import type { WardrobeItem, WardrobeItemId, WardrobeSlot } from '@domain/avatar/wardrobe-item';
import type { AvatarRig } from '@presentation/actors/avatar-rigs';
import type { Clothes, Expression, Figure } from '@presentation/actors/child-figure';
import { buildAccessory, type Anchor } from '@presentation/actors/wardrobe-meshes';
import { dampAngle } from '@presentation/engine/math';
import { resolveCollisions, type Collider } from '@presentation/world/collision';

export type Emote =
  | 'Wave'
  | 'Dance'
  | 'ThumbsUp'
  | 'Yes'
  | 'Sit'
  | 'Stand'
  | 'Lie'
  | 'Eat'
  | 'SitEat'
  | 'Drink'
  | 'Brush'
  | 'Wash'
  | 'Pick'
  | 'Carry'
  | 'Throw'
  | 'Kick'
  | 'Swim';
type Motion = 'idle' | 'walk' | 'run' | 'jump';

/** Standard clip for each emote, with fallbacks for models that lack it. */
const emoteClips: Record<Emote, readonly string[]> = {
  Wave: ['wave'],
  Yes: ['yes', 'wave'],
  ThumbsUp: ['thumbs', 'yes'],
  Dance: ['dance', 'wave'],
  Sit: ['sit'],
  Stand: ['stand'],
  Lie: ['lie'],
  Eat: ['eat', 'yes'],
  SitEat: ['sit-eat', 'eat', 'yes'],
  Drink: ['drink', 'yes'],
  Brush: ['brush', 'yes'],
  Wash: ['wash', 'yes'],
  Pick: ['pick', 'yes'],
  Carry: ['carry'],
  Throw: ['throw', 'wave'],
  Kick: ['kick', 'yes'],
  Swim: ['swim'],
};

/** These stay until the character moves again: sitting does not end by itself. */
const heldEmotes: ReadonlySet<Emote> = new Set(['Sit', 'Lie', 'Carry', 'Swim']);

export interface Ground {
  heightAt(x: number, z: number): number;
  isWalkable(x: number, z: number): boolean;
  readonly colliders: readonly Collider[];
}

const RADIUS = 0.45;
const WALK_SPEED = 3.8;
const RUN_SPEED = 7.5;
const JUMP_SPEED = 7.2;
const GRAVITY = 21;

/**
 * The child's character: any animated avatar (CC0 models by Quaternius) with
 * colors and accessories. Movement is kinematic and forgiving: it climbs any
 * hill, never falls into the sea and never "dies".
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
  private readonly bodyMaterial: THREE.MeshStandardMaterial | undefined;
  private readonly trimMaterial: THREE.MeshStandardMaterial | undefined;
  private readonly defaultBody: number | undefined;
  private readonly defaultTrim: number | undefined;
  private readonly groundOffset: number;
  private foam: THREE.Group | undefined;
  private idle = 'idle';

  constructor(
    private readonly model: THREE.Object3D,
    animations: readonly THREE.AnimationClip[],
    readonly avatarId: string,
    rig: AvatarRig,
    private readonly figure?: Figure,
  ) {
    // Bones must have up-to-date matrices before skinned meshes can be measured.
    model.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(model, true).getSize(new THREE.Vector3());
    model.scale.setScalar(rig.height / Math.max(0.001, figure?.body.height ?? size.y));
    model.updateMatrixWorld(true);
    model.position.y -= new THREE.Box3().setFromObject(model, true).min.y;

    const materials = new Map<string, THREE.MeshStandardMaterial>();
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
      const list = (
        Array.isArray(object.material) ? object.material : [object.material]
      ) as THREE.MeshStandardMaterial[];
      for (const material of list) {
        material.flatShading = rig.flatShading;
        material.roughness = 0.6;
        material.metalness = 0;
        material.needsUpdate = true;
        materials.set(material.name, material);
      }
    });
    this.bodyMaterial =
      rig.bodyMaterial === undefined ? undefined : materials.get(rig.bodyMaterial);
    this.trimMaterial =
      rig.trimMaterial === undefined ? undefined : materials.get(rig.trimMaterial);
    this.defaultBody = rig.defaultBody ?? this.bodyMaterial?.color.getHex();
    this.defaultTrim = rig.defaultTrim ?? this.trimMaterial?.color.getHex();

    this.groundOffset = model.position.y;
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.mixer.addEventListener('finished', () => {
      if (this.emote !== null && !heldEmotes.has(this.emote)) this.emote = null;
    });

    const { anchors, headWidth } = createAnchors(this.root, model, rig);
    this.anchors = anchors;
    this.headWidth = headWidth;
    this.play('idle', 0);
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
    const clip = emoteClips[emote].find((name) => this.actions.has(name));
    if (clip === undefined) return;
    this.emote = emote;
    this.play(clip, 0.2, emote !== 'Swim');
  }

  /** Costumes can walk and greet, but only the child has the motions of daily life. */
  canDo(emote: Emote): boolean {
    return this.actions.has(emoteClips[emote][0] ?? '');
  }

  /** How the character stands still: hugging itself in the cold, or hiding from the rain. */
  setPosture(posture: 'fine' | 'cold' | 'wet'): void {
    const name = { fine: 'idle', cold: 'shiver', wet: 'cover' }[posture];
    this.idle = this.actions.has(name) ? name : 'idle';
  }

  /** Ends a motion that holds, such as sitting. */
  release(): void {
    this.emote = null;
  }

  /** Raises the body over the floor: on a chair or in bed. */
  setPerch(height: number): void {
    this.model.position.y = this.groundOffset + height;
  }

  /** Toothpaste foam, while brushing. */
  showFoam(on: boolean): void {
    if (!on) {
      this.foam?.removeFromParent();
      this.foam = undefined;
      return;
    }
    if (this.foam === undefined) {
      const size = this.headWidth;
      const bubbles = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size * 0.16, 1),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
      );
      const brush = new THREE.Mesh(
        new THREE.BoxGeometry(size * 0.5, size * 0.05, size * 0.05),
        new THREE.MeshStandardMaterial({ color: 0x3fa9f5 }),
      );
      brush.position.set(-size * 0.3, 0, size * 0.08);
      this.foam = new THREE.Group().add(bubbles, brush);
      this.foam.position.y = -size * 0.3;
    }
    this.anchors.face.add(this.foam);
  }

  /** Changes clothes on the same body. Only the customizable child has them. */
  wear(clothes: Clothes): void {
    this.figure?.wear(clothes);
  }

  feel(expression: Expression): void {
    this.figure?.feel(expression);
  }

  /** Dev only: holds the current motion at one moment, to look at it closely. */
  freezeAt(seconds: number): void {
    if (this.current !== undefined) {
      this.current.time = seconds;
      this.current.paused = true;
    }
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
      this.setPerch(0);
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

    const body = itemIn('body')?.color ?? this.defaultBody;
    if (body !== undefined) this.bodyMaterial?.color.setHex(body);
    const trim = itemIn('trim')?.color ?? this.defaultTrim;
    if (trim !== undefined) this.trimMaterial?.color.setHex(trim);
    this.figure?.tint(itemIn('body')?.color, itemIn('trim')?.color);

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

  dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
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
      this.play('jump', 0.12, true);
      return;
    }
    if (this.emote !== null) return;
    const motion: Motion = this.speed > 5.2 ? 'run' : this.speed > 0.3 ? 'walk' : 'idle';
    this.play(motion === 'idle' ? this.idle : motion, 0.25);
    if (this.current !== undefined && motion !== 'idle') {
      this.current.timeScale =
        motion === 'run' ? this.speed / RUN_SPEED + 0.2 : this.speed / WALK_SPEED;
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
 * Bounding box of the vertices that move mostly with one bone (for skinned
 * models), or of the meshes attached under it (for rigid-part models).
 */
function boneBox(model: THREE.Object3D, bone: THREE.Object3D | undefined): THREE.Box3 {
  const box = new THREE.Box3();
  if (bone === undefined) return box;
  const point = new THREE.Vector3();

  model.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const index = object.skeleton.bones.indexOf(bone as THREE.Bone);
    if (index < 0) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    const skinIndex = geometry.getAttribute('skinIndex');
    const skinWeight = geometry.getAttribute('skinWeight');
    for (let i = 0; i < geometry.getAttribute('position').count; i += 1) {
      let weight = 0;
      for (let k = 0; k < 4; k += 1) {
        if (skinIndex.getComponent(i, k) === index) weight += skinWeight.getComponent(i, k);
      }
      if (weight < 0.5) continue;
      object.getVertexPosition(i, point);
      box.expandByPoint(point.applyMatrix4(object.matrixWorld));
    }
  });

  if (box.isEmpty()) {
    bone.traverse((child) => {
      if (child instanceof THREE.Mesh) box.expandByObject(child);
    });
  }
  return box;
}

/**
 * Creates empty objects glued to the head and torso bones, measured in the
 * rest pose, so accessories follow every animation and fit every avatar.
 */
function createAnchors(
  root: THREE.Object3D,
  model: THREE.Object3D,
  rig: AvatarRig,
): { anchors: Record<Anchor, THREE.Object3D>; headWidth: number } {
  // The root is still unplaced (identity), so world coordinates equal root coordinates.
  root.updateMatrixWorld(true);
  let headBone: THREE.Object3D | undefined;
  let torsoBone: THREE.Object3D | undefined;
  model.traverse((object) => {
    if (object instanceof THREE.Bone && object.name === 'Head') headBone ??= object;
    if (object instanceof THREE.Bone && object.name === 'Torso') torsoBone ??= object;
  });

  const whole = new THREE.Box3().setFromObject(model);
  const wholeSize = whole.getSize(new THREE.Vector3());
  let head = boneBox(model, headBone);
  if (head.isEmpty()) {
    head = new THREE.Box3(
      new THREE.Vector3(whole.min.x, whole.max.y - wholeSize.y * 0.35, whole.min.z),
      whole.max.clone(),
    );
  }
  // Long ears or antennae belong to the head bone too; a head is about as tall as it is wide.
  const headWidthGuess = Math.max(head.max.x - head.min.x, (head.max.z - head.min.z) * 0.9);
  head.max.y = Math.min(head.max.y, head.min.y + headWidthGuess * 1.1);
  let torso = boneBox(model, torsoBone);
  if (torso.isEmpty()) torso = whole.clone();

  if (rig.fit !== undefined) {
    const halfWidth = (rig.fit.headWidth * rig.height) / 2;
    const center = head.getCenter(new THREE.Vector3());
    const eyes = rig.fit.eyes * rig.height;
    head.min.set(center.x - halfWidth, eyes - (rig.fit.headTop * rig.height - eyes), head.min.z);
    head.max.set(center.x + halfWidth, rig.fit.headTop * rig.height, head.max.z);
  }
  const headSize = head.getSize(new THREE.Vector3());
  const headCenter = head.getCenter(new THREE.Vector3());
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
    (parent ?? model).attach(anchor);
    return anchor;
  };

  return {
    headWidth: Math.max(headSize.x, headSize.z * 0.9),
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
