import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fitToHand, handHolder } from '@presentation/actors/arm-poses';
import { restClips } from '@presentation/actors/rest-poses';

function named(name: string, parent: THREE.Object3D, y: number, x = 0): THREE.Bone {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.position.set(x, y, 0);
  parent.add(bone);
  return bone;
}

/** A skeleton like the models': the feet hang from the root, not from the shins. */
function rig() {
  const model = new THREE.Group();
  const skin = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
  skin.position.y = 1;
  model.add(skin);
  const root = named('Root', model, 0);
  const body = named('Body', root, 1);
  const legs = (['L', 'R'] as const).map((side) => {
    const x = side === 'L' ? 0.2 : -0.2;
    const thigh = named(`UpperLeg${side}`, body, 0, x);
    thigh.rotation.x = Math.PI;
    const shin = named(`LowerLeg${side}`, thigh, 0.5);
    const foot = named(`Foot${side}`, root, 0, x);
    return { shin, foot };
  });
  const head = named('Head', body, 0.8);
  const upper = named('UpperArmR', body, 0.6, -0.3);
  upper.rotation.x = Math.PI;
  const lower = named('LowerArmR', upper, 0.3);
  const hand = named('Middle1R', lower, 0.3);
  const idle = new THREE.AnimationClip('idle', 2, [
    new THREE.VectorKeyframeTrack('Head.position', [0, 2], [0, 0.8, 0, 0, 0.8, 0]),
  ]);
  const nod = new THREE.AnimationClip('yes', 1, []);
  return { model, body, head, legs, hand, clips: [idle, nod] };
}

function posed(model: THREE.Object3D, clip: THREE.AnimationClip): void {
  new THREE.AnimationMixer(model).clipAction(clip).play().getMixer().update(0);
  model.updateMatrixWorld(true);
}

describe('resting, for models without it', () => {
  const y = (bone: THREE.Object3D) => bone.getWorldPosition(new THREE.Vector3()).y;
  const z = (bone: THREE.Object3D) => bone.getWorldPosition(new THREE.Vector3()).z;

  it('adds what the day asks for', () => {
    const { model, clips } = rig();
    const names = restClips(model, clips).map((clip) => clip.name);
    expect(names).toEqual([
      'sit',
      'lie',
      'kick',
      'sit-eat',
      'push-idle',
      'throw',
      'stretch',
      'tap',
      'wash',
      'pick',
      'eat',
      'drink',
      'brush',
    ]);
  });

  it('swings the leg forward to kick, with the foot that hangs from the root', () => {
    const { model, legs, clips } = rig();
    const kick = restClips(model, clips).find((clip) => clip.name === 'kick');
    const right = legs[1];
    if (kick === undefined || right === undefined) throw new Error('no clip');
    const standing = z(right.foot);
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(kick).play();
    mixer.update(kick.duration * 0.7);
    model.updateMatrixWorld(true);
    expect(z(right.foot)).toBeGreaterThan(standing + 0.5);
    expect(y(right.foot)).toBeGreaterThan(0.1);
  });

  it('keeps both hands forward to push, on the motions of the model', () => {
    const { model, hand, clips } = rig();
    const walk = new THREE.AnimationClip('walk', 1, []);
    const made = restClips(model, [...clips, walk]);
    expect(made.map((clip) => clip.name)).toContain('push-walk');
    const push = made.find((clip) => clip.name === 'push-idle');
    if (push === undefined) throw new Error('no clip');
    posed(model, push);
    expect(z(hand)).toBeGreaterThan(0.3);
  });

  it('stretches the arm to reach, and comes back to rest', () => {
    const { model, hand, clips } = rig();
    const tap = restClips(model, clips).find((clip) => clip.name === 'tap');
    if (tap === undefined) throw new Error('no clip');
    expect(tap.duration).toBeLessThan(1);
    const action = new THREE.AnimationMixer(model).clipAction(tap).play();
    action.getMixer().setTime(tap.duration / 2);
    model.updateMatrixWorld(true);
    expect(z(hand)).toBeGreaterThan(0.5);
    action.getMixer().setTime(tap.duration - 0.001);
    model.updateMatrixWorld(true);
    expect(z(hand)).toBeCloseTo(0, 1);
  });

  it('brings the hand toward the face to eat', () => {
    const { model, hand, head, clips } = rig();
    const eat = restClips(model, clips).find((clip) => clip.name === 'eat');
    if (eat === undefined) throw new Error('no clip');
    const before = hand.getWorldPosition(new THREE.Vector3());
    const action = new THREE.AnimationMixer(model).clipAction(eat).play();
    action.getMixer().setTime(eat.duration / 2);
    model.updateMatrixWorld(true);
    const near = hand.getWorldPosition(new THREE.Vector3());
    const face = head.getWorldPosition(new THREE.Vector3());
    expect(near.distanceTo(face)).toBeLessThan(before.distanceTo(face));
  });

  it('lies on the back, with the head toward the pillow and the feet away', () => {
    const { model, body, head, legs, clips } = rig();
    const lie = restClips(model, clips).find((clip) => clip.name === 'lie');
    if (lie === undefined) throw new Error('no clip');
    posed(model, lie);
    expect(y(body)).toBeCloseTo(0.45);
    expect(y(head)).toBeCloseTo(0.45);
    expect(z(body)).toBeCloseTo(0);
    expect(z(head)).toBeCloseTo(-0.8);
    for (const { foot } of legs) expect(z(foot)).toBeCloseTo(1);
  });

  it('brings the hips to the seat, the knees forward and the feet down', () => {
    const { model, body, legs, clips } = rig();
    const sit = restClips(model, clips).find((clip) => clip.name === 'sit');
    if (sit === undefined) throw new Error('no clip');
    posed(model, sit);
    expect(y(body)).toBeCloseTo(0.46);
    for (const { shin, foot } of legs) {
      expect(z(shin)).toBeCloseTo(0.5);
      expect(y(shin)).toBeCloseTo(0.46);
      expect(z(foot)).toBeCloseTo(0.5);
      expect(y(foot)).toBeCloseTo(-0.04);
    }
  });

  it('leaves the model as it was', () => {
    const { model, body, clips } = rig();
    restClips(model, clips);
    expect(y(body)).toBeCloseTo(1);
  });

  it('keeps what is held at the hand, at the size of the world', () => {
    const { model, hand } = rig();
    model.scale.setScalar(2);
    model.updateMatrixWorld(true);
    const held = handHolder(model);
    if (held === undefined) throw new Error('no hand');
    const card = new THREE.Group();
    fitToHand(held, 'card', card);
    expect(card.parent?.parent).toBe(hand);
    model.updateMatrixWorld(true);
    expect(card.getWorldScale(new THREE.Vector3()).x).toBeCloseTo(1.5);
  });

  it('does nothing for a model with other bones', () => {
    expect(restClips(new THREE.Group(), [new THREE.AnimationClip('idle', 1, [])])).toEqual([]);
  });
});
