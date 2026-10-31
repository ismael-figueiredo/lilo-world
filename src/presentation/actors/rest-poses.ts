import * as THREE from 'three';
import { armGestures } from '@presentation/actors/arm-poses';

/** Thigh room between the seat and the hips, as a part of the thigh. */
const ON_THE_SEAT = 0.5;

/** Height of the hips over the mattress, as a part of their height over the floor. */
const ON_THE_BED = 0.45;

const down = new THREE.Vector3(0, -1, 0);
const onTheBack = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

interface Leg {
  readonly thigh: THREE.Object3D;
  readonly shin: THREE.Object3D;
  readonly foot: THREE.Object3D;
}

function bone(model: THREE.Object3D, name: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  model.traverse((object) => {
    if (found === undefined && object instanceof THREE.Bone && object.name === name) {
      found = object;
    }
  });
  return found;
}

function legOf(model: THREE.Object3D, side: 'L' | 'R'): Leg | undefined {
  const thigh = bone(model, `UpperLeg${side}`);
  const shin = bone(model, `LowerLeg${side}`);
  const foot = bone(model, `Foot${side}`);
  return thigh === undefined || shin === undefined || foot === undefined
    ? undefined
    : { thigh, shin, foot };
}

const place = (object: THREE.Object3D): THREE.Vector3 =>
  object.getWorldPosition(new THREE.Vector3());

const turning = (object: THREE.Object3D): THREE.Quaternion =>
  object.getWorldQuaternion(new THREE.Quaternion());

const fixedPlace = (object: THREE.Object3D, worldPoint: THREE.Vector3): THREE.KeyframeTrack => {
  const local = object.parent?.worldToLocal(worldPoint.clone()) ?? worldPoint;
  return new THREE.VectorKeyframeTrack(`${object.name}.position`, [0], local.toArray());
};

const fixedTurn = (object: THREE.Object3D, local: THREE.Quaternion): THREE.KeyframeTrack =>
  new THREE.QuaternionKeyframeTrack(`${object.name}.quaternion`, [0], local.toArray());

/** The hips come down to the seat, the thighs go forward and the shins hang. */
function seatedLegs(body: THREE.Object3D, legs: readonly Leg[]): THREE.KeyframeTrack[] {
  const floor = Math.min(...legs.map((leg) => place(leg.foot).y));
  const [first] = legs;
  if (first === undefined) return [];
  const hips = place(first.thigh);
  const thighLength = hips.distanceTo(place(first.shin));
  const drop = hips.y - floor - thighLength * ON_THE_SEAT;
  const tracks = [fixedPlace(body, place(body).setY(place(body).y - drop))];

  for (const { thigh, shin, foot } of legs) {
    const hip = place(thigh);
    const knee = place(shin);
    const ankle = place(foot);
    const along = knee.clone().sub(hip).normalize();
    const forward = new THREE.Vector3(along.x, 0, 1).normalize();
    const thighTurn = new THREE.Quaternion()
      .setFromUnitVectors(along, forward)
      .multiply(turning(thigh));
    const shinTurn = new THREE.Quaternion()
      .setFromUnitVectors(ankle.clone().sub(knee).normalize(), down)
      .multiply(turning(shin));
    const seatedAnkle = hip
      .clone()
      .setY(hip.y - drop)
      .addScaledVector(forward, hip.distanceTo(knee))
      .addScaledVector(down, knee.distanceTo(ankle));
    const parentTurn = thigh.parent === null ? new THREE.Quaternion() : turning(thigh.parent);
    tracks.push(
      fixedTurn(thigh, parentTurn.invert().multiply(thighTurn)),
      fixedTurn(shin, thighTurn.clone().invert().multiply(shinTurn)),
      fixedPlace(foot, seatedAnkle),
    );
  }
  return tracks;
}

/** The whole body turns over its hips, with the face up and the head toward the pillow. */
function lyingBody(whole: THREE.Object3D, legs: readonly Leg[]): THREE.KeyframeTrack[] {
  const [first] = legs;
  if (first === undefined) return [];
  const hips = place(first.thigh);
  const rest = new THREE.Vector3(0, (hips.y - place(first.foot).y) * ON_THE_BED, 0);
  const turned = place(whole).sub(hips).applyQuaternion(onTheBack).add(rest);
  const parentTurn = whole.parent === null ? new THREE.Quaternion() : turning(whole.parent);
  return [
    fixedPlace(whole, turned),
    fixedTurn(whole, parentTurn.invert().multiply(onTheBack).multiply(turning(whole))),
  ];
}

/**
 * Sitting, lying down and using the hand, for models that came without them:
 * built from their own bones, over the motion of the clip they are based on.
 */
export function restClips(
  model: THREE.Object3D,
  clips: readonly THREE.AnimationClip[],
): THREE.AnimationClip[] {
  const idle = clips.find((clip) => clip.name === 'idle');
  const body = bone(model, 'Body');
  const legs = [legOf(model, 'L'), legOf(model, 'R')].filter((leg) => leg !== undefined);
  const whole = body?.parent;
  if (idle === undefined || body === undefined || !whole || legs.length < 2) return [];

  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(idle).play();
  mixer.update(0);
  model.updateMatrixWorld(true);
  const legTracks = seatedLegs(body, legs);
  const bedTracks = lyingBody(whole, legs);
  const arm = armGestures(model);
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  model.updateMatrixWorld(true);

  const posed = (
    base: THREE.AnimationClip,
    name: string,
    tracks: readonly THREE.KeyframeTrack[],
  ): THREE.AnimationClip => {
    const replaced = new Set(tracks.map((track) => track.name));
    const moving = tracks.filter((track) => track.times.length > 1);
    const seconds = Math.max(0, ...moving.flatMap((track) => [...track.times]));
    return new THREE.AnimationClip(name, seconds || base.duration, [
      ...base.tracks.filter((track) => !replaced.has(track.name)),
      ...tracks,
    ]);
  };
  const rest = [posed(idle, 'sit', legTracks), posed(idle, 'lie', bedTracks)];
  if (arm === undefined) return rest;
  const { reach, toMouth } = arm;
  return [
    ...rest,
    posed(idle, 'sit-eat', [...legTracks, ...toMouth]),
    ...['tap', 'wash'].map((name) => posed(idle, name, reach)),
    ...['eat', 'drink', 'brush'].map((name) => posed(idle, name, toMouth)),
  ];
}
