import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { seatedClips } from '@presentation/actors/seated-pose';

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
  const idle = new THREE.AnimationClip('idle', 2, [
    new THREE.VectorKeyframeTrack('Head.position', [0, 2], [0, 0.8, 0, 0, 0.8, 0]),
  ]);
  const nod = new THREE.AnimationClip('yes', 1, []);
  return { model, body, head, legs, clips: [idle, nod] };
}

function posed(model: THREE.Object3D, clip: THREE.AnimationClip): void {
  new THREE.AnimationMixer(model).clipAction(clip).play().getMixer().update(0);
  model.updateMatrixWorld(true);
}

describe('sitting, for models without it', () => {
  const y = (bone: THREE.Object3D) => bone.getWorldPosition(new THREE.Vector3()).y;
  const z = (bone: THREE.Object3D) => bone.getWorldPosition(new THREE.Vector3()).z;

  it('adds sitting and eating while seated', () => {
    const { model, clips } = rig();
    expect(seatedClips(model, clips).map((clip) => clip.name)).toEqual(['sit', 'sit-eat']);
  });

  it('brings the hips to the seat, the knees forward and the feet down', () => {
    const { model, body, legs, clips } = rig();
    const [sit] = seatedClips(model, clips);
    if (sit === undefined) throw new Error('no clip');
    posed(model, sit);
    expect(y(body)).toBeCloseTo(0.25);
    for (const { shin, foot } of legs) {
      expect(z(shin)).toBeCloseTo(0.5);
      expect(y(shin)).toBeCloseTo(0.25);
      expect(z(foot)).toBeCloseTo(0.5);
      expect(y(foot)).toBeCloseTo(-0.25);
    }
  });

  it('leaves the model as it was', () => {
    const { model, body, clips } = rig();
    seatedClips(model, clips);
    expect(y(body)).toBeCloseTo(1);
  });

  it('does nothing for a model with other bones', () => {
    expect(seatedClips(new THREE.Group(), [new THREE.AnimationClip('idle', 1, [])])).toEqual([]);
  });
});
