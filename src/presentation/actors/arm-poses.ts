import * as THREE from 'three';
import type { HeldThing } from '@presentation/actors/child-figure';

/** Where the elbow goes when the hand comes to the face, on the right side. */
const ELBOW_OUT = new THREE.Vector3(-0.6, -0.8, 0);
/** The arm stretched out, a little under the shoulder. */
const STRETCHED = new THREE.Vector3(0, -0.15, 1).normalize();
/** The mouth in front of the head, as a part of the height of the model. */
const BEFORE_THE_FACE = 0.16;
/** Room between the hand and the mouth for the spoon, as a part of the height of the model. */
const SPOON_ROOM = 0.16;
/** The hand stops under the mouth, to its own side, on the right. */
const BESIDE_THE_MOUTH = new THREE.Vector3(-0.5, -0.8, 0.3).normalize();
/** The moments of a gesture, as parts of its length: out, held, back. */
const GESTURE = [0, 0.3, 0.7, 1] as const;

/** Hands of models are big: what they hold has to show out of them. */
const HELD_SIZE = 1.5;

/** These stick out of the fingers, at this size; the others hang from the hand. */
const TOOLS: ReadonlyMap<HeldThing, number> = new Map([
  ['toothbrush', 0.7],
  ['spoon', 0.7],
  ['ladle', 0.7],
  ['card', 1],
]);

const REACH_SECONDS = 0.9;
const MOUTH_SECONDS = 1.5;
const THROW_SECONDS = 0.9;
const STRETCH_SECONDS = 1.2;

/** The arm goes up behind the head, and comes forward letting the ball go. */
const WOUND_UPPER = new THREE.Vector3(0, 0.75, -0.65).normalize();
const WOUND_LOWER = new THREE.Vector3(0, 0.9, 0.45).normalize();
const RELEASE = new THREE.Vector3(0, 0.55, 0.85).normalize();
/** Both arms over the head, a little open. */
const ARM_UP = new THREE.Vector3(0.15, 1, 0).normalize();
/** Both hands forward at the height of a cart's handle. */
const PUSH_UPPER = new THREE.Vector3(0.1, -0.5, 0.86).normalize();
const PUSH_LOWER = new THREE.Vector3(0, -0.1, 1).normalize();

export interface ArmGestures {
  /** The arm reaches forward: a card to the reader, hands to the tap. */
  readonly reach: THREE.KeyframeTrack[];
  /** The hand comes to the mouth and goes back. */
  readonly toMouth: THREE.KeyframeTrack[];
  /** Up behind the head and forward: a ball leaves the hand. */
  readonly throwing: THREE.KeyframeTrack[];
  /** Both arms go up over the head. */
  readonly stretch: THREE.KeyframeTrack[];
  /** Both hands stay forward, on a cart: it replaces the arms of walking and standing. */
  readonly push: THREE.KeyframeTrack[];
}

export interface Hand {
  readonly holder: THREE.Group;
  /** Lays a card along the forearm. */
  readonly alongForearm: THREE.Quaternion;
  /** Points a spoon at the mouth, once the hand is there. */
  readonly towardMouth: THREE.Quaternion;
}

type Side = 'L' | 'R';

interface Arm {
  readonly upper: THREE.Object3D;
  readonly lower: THREE.Object3D;
  readonly hand: THREE.Object3D;
  readonly head: THREE.Object3D;
}

/** The directions of the arm, and of what it holds, with the hand at the mouth. */
interface MouthPose {
  readonly upperTo: THREE.Vector3;
  readonly lowerTo: THREE.Vector3;
  readonly tool: THREE.Vector3;
}

function boneNamed(model: THREE.Object3D, name: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  model.traverse((object) => {
    if (found === undefined && object instanceof THREE.Bone && object.name === name) {
      found = object;
    }
  });
  return found;
}

const place = (object: THREE.Object3D): THREE.Vector3 =>
  object.getWorldPosition(new THREE.Vector3());

const turning = (object: THREE.Object3D): THREE.Quaternion =>
  object.getWorldQuaternion(new THREE.Quaternion());

/** The time of each moment of a gesture of this length. */
export const gestureTimes = (seconds: number): number[] =>
  GESTURE.map((moment) => moment * seconds);

/** A joint leaves its rest, goes through two turns and comes back. */
export function gesture(
  object: THREE.Object3D,
  first: THREE.Quaternion,
  second: THREE.Quaternion,
  seconds: number,
): THREE.KeyframeTrack {
  const rest = object.quaternion.toArray();
  return new THREE.QuaternionKeyframeTrack(`${object.name}.quaternion`, gestureTimes(seconds), [
    ...rest,
    ...first.toArray(),
    ...second.toArray(),
    ...rest,
  ]);
}

/** The local turns of the upper arm and the forearm that point them in these directions. */
function armTurns(
  { upper, lower, hand }: Arm,
  upperTo: THREE.Vector3,
  lowerTo: THREE.Vector3,
): readonly [THREE.Quaternion, THREE.Quaternion] {
  const shoulder = place(upper);
  const elbow = place(lower);
  const upperTurn = new THREE.Quaternion()
    .setFromUnitVectors(elbow.clone().sub(shoulder).normalize(), upperTo)
    .multiply(turning(upper));
  const lowerTurn = new THREE.Quaternion()
    .setFromUnitVectors(place(hand).sub(elbow).normalize(), lowerTo)
    .multiply(turning(lower));
  const parentTurn = upper.parent === null ? new THREE.Quaternion() : turning(upper.parent);
  return [parentTurn.invert().multiply(upperTurn), upperTurn.clone().invert().multiply(lowerTurn)];
}

/** The arm goes through two poses, each one its upper arm and forearm directions. */
function armThrough(
  arm: Arm,
  [firstUpper, firstLower]: readonly [THREE.Vector3, THREE.Vector3],
  [secondUpper, secondLower]: readonly [THREE.Vector3, THREE.Vector3],
  seconds: number,
): THREE.KeyframeTrack[] {
  const [upperFirst, lowerFirst] = armTurns(arm, firstUpper, firstLower);
  const [upperSecond, lowerSecond] = armTurns(arm, secondUpper, secondLower);
  return [
    gesture(arm.upper, upperFirst, upperSecond, seconds),
    gesture(arm.lower, lowerFirst, lowerSecond, seconds),
  ];
}

/** The arm goes to one pose, holds it and comes back. */
function armTo(
  arm: Arm,
  upperTo: THREE.Vector3,
  lowerTo: THREE.Vector3,
  seconds: number,
): THREE.KeyframeTrack[] {
  return armThrough(arm, [upperTo, lowerTo], [upperTo, lowerTo], seconds);
}

/** Where the elbow stands for two bones to reach from the shoulder to the wrist. */
function elbowFor(
  shoulder: THREE.Vector3,
  wrist: THREE.Vector3,
  upperLength: number,
  forearm: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const span = wrist.clone().sub(shoulder);
  const reach = THREE.MathUtils.clamp(
    span.length(),
    Math.abs(upperLength - forearm) + 1e-6,
    upperLength + forearm - 1e-6,
  );
  const along = span.normalize();
  const fromShoulder = (reach ** 2 + upperLength ** 2 - forearm ** 2) / (2 * reach);
  const aside = Math.sqrt(Math.max(0, upperLength ** 2 - fromShoulder ** 2));
  const pole = out.clone().addScaledVector(along, -out.dot(along)).normalize();
  return shoulder.clone().addScaledVector(along, fromShoulder).addScaledVector(pole, aside);
}

function armOf(model: THREE.Object3D, side: Side = 'R'): Arm | undefined {
  const upper = boneNamed(model, `UpperArm${side}`);
  const lower = boneNamed(model, `LowerArm${side}`);
  const hand = boneNamed(model, `Middle1${side}`);
  const head = boneNamed(model, 'Head');
  return upper === undefined || lower === undefined || hand === undefined || head === undefined
    ? undefined
    : { upper, lower, hand, head };
}

function mouthPose(model: THREE.Object3D, { upper, lower, hand, head }: Arm): MouthPose {
  const shoulder = place(upper);
  const elbowAt = place(lower);
  const flip = shoulder.x > place(head).x ? -1 : 1;
  const mirrored = (direction: THREE.Vector3): THREE.Vector3 =>
    direction.clone().setX(direction.x * flip);
  const upperLength = shoulder.distanceTo(elbowAt);
  const forearm = elbowAt.distanceTo(place(hand));
  const height = new THREE.Box3().setFromObject(model, true).getSize(new THREE.Vector3()).y;
  const mouth = place(head).add(new THREE.Vector3(0, 0, height * BEFORE_THE_FACE));
  const wrist = mouth.clone().addScaledVector(mirrored(BESIDE_THE_MOUTH), height * SPOON_ROOM);
  const elbow = elbowFor(shoulder, wrist, upperLength, forearm, mirrored(ELBOW_OUT));
  const lowerTo = wrist.clone().sub(elbow).normalize();
  const reached = elbow.clone().addScaledVector(lowerTo, forearm);
  return {
    upperTo: elbow.clone().sub(shoulder).normalize(),
    lowerTo,
    tool: mouth.sub(reached).normalize(),
  };
}

/** The right arm's gestures, measured on the model as it stands now. */
export function armGestures(model: THREE.Object3D): ArmGestures | undefined {
  const arm = armOf(model);
  if (arm === undefined) return undefined;
  const { upperTo, lowerTo } = mouthPose(model, arm);
  const armUp = (one: Arm): THREE.KeyframeTrack[] => {
    const out = place(one.upper).x > place(one.head).x ? 1 : -1;
    const up = ARM_UP.clone().setX(ARM_UP.x * out);
    return armTo(one, up, up, STRETCH_SECONDS);
  };
  const onTheHandle = (one: Arm): THREE.KeyframeTrack[] => {
    const out = place(one.upper).x > place(one.head).x ? 1 : -1;
    const upperTo = PUSH_UPPER.clone().setX(PUSH_UPPER.x * out);
    const [upperTurn, lowerTurn] = armTurns(one, upperTo, PUSH_LOWER);
    return [
      new THREE.QuaternionKeyframeTrack(`${one.upper.name}.quaternion`, [0], upperTurn.toArray()),
      new THREE.QuaternionKeyframeTrack(`${one.lower.name}.quaternion`, [0], lowerTurn.toArray()),
    ];
  };
  const other = armOf(model, 'L');
  return {
    reach: armTo(arm, STRETCHED, STRETCHED, REACH_SECONDS),
    toMouth: armTo(arm, upperTo, lowerTo, MOUTH_SECONDS),
    throwing: armThrough(arm, [WOUND_UPPER, WOUND_LOWER], [RELEASE, RELEASE], THROW_SECONDS),
    stretch: [...armUp(arm), ...(other === undefined ? [] : armUp(other))],
    push: [...onTheHandle(arm), ...(other === undefined ? [] : onTheHandle(other))],
  };
}

/** A place at the fingertips for what the model holds, upright when it stands still. */
export function handHolder(model: THREE.Object3D): Hand | undefined {
  const arm = armOf(model);
  if (arm === undefined) return undefined;
  const { lowerTo, tool } = mouthPose(model, arm);
  const forearm = place(arm.hand).sub(place(arm.lower)).normalize();
  let finger = arm.hand;
  let next = finger.children.find((child) => child instanceof THREE.Bone);
  while (next !== undefined) {
    finger = next;
    next = finger.children.find((child) => child instanceof THREE.Bone);
  }
  const holder = new THREE.Group();
  holder.quaternion.copy(turning(finger).invert());
  holder.scale.setScalar(HELD_SIZE / finger.getWorldScale(new THREE.Vector3()).x);
  finger.add(holder);
  const forward = new THREE.Vector3(0, 0, 1);
  const raised = new THREE.Quaternion().setFromUnitVectors(forearm, lowerTo).invert();
  return {
    holder,
    alongForearm: new THREE.Quaternion().setFromUnitVectors(forward, forearm),
    towardMouth: new THREE.Quaternion().setFromUnitVectors(forward, tool.applyQuaternion(raised)),
  };
}

/** The card continues the arm toward the reader, and a spoon points at the mouth. */
export function fitToHand(hand: Hand, thing: HeldThing, shape: THREE.Object3D): void {
  const size = TOOLS.get(thing);
  if (size !== undefined) {
    shape.quaternion.copy(thing === 'card' ? hand.alongForearm : hand.towardMouth);
    shape.scale.setScalar(size);
  }
  hand.holder.add(shape);
}
