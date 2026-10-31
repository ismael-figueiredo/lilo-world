import * as THREE from 'three';

/** Thigh room between the seat and the hips, as a part of the thigh. */
const ON_THE_SEAT = 0.5;

const down = new THREE.Vector3(0, -1, 0);

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

/**
 * Sitting, for models that came without it: built from their own bones, so the
 * upper body keeps the motion of the clip it is based on.
 */
export function seatedClips(
  model: THREE.Object3D,
  clips: readonly THREE.AnimationClip[],
): THREE.AnimationClip[] {
  const idle = clips.find((clip) => clip.name === 'idle');
  const body = bone(model, 'Body');
  const legs = [legOf(model, 'L'), legOf(model, 'R')].filter((leg) => leg !== undefined);
  if (idle === undefined || body === undefined || legs.length < 2) return [];

  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(idle).play();
  mixer.update(0);
  model.updateMatrixWorld(true);
  const legTracks = seatedLegs(body, legs);
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  model.updateMatrixWorld(true);

  const replaced = new Set(legTracks.map((track) => track.name));
  const onTheSeat = (base: THREE.AnimationClip, name: string): THREE.AnimationClip =>
    new THREE.AnimationClip(name, base.duration, [
      ...base.tracks.filter((track) => !replaced.has(track.name)),
      ...legTracks,
    ]);
  const nod = clips.find((clip) => clip.name === 'yes');
  return [onTheSeat(idle, 'sit'), ...(nod === undefined ? [] : [onTheSeat(nod, 'sit-eat')])];
}
