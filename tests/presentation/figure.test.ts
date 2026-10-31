import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { defaultChildChoices, guardians, outfits } from '@domain/avatar/child';
import { cast, guardianPerson } from '@presentation/actors/cast';
import {
  Figure,
  FIGURE_JOINTS,
  figureClips,
  outfitClothes,
} from '@presentation/actors/child-figure';

describe('the motions of a figure', () => {
  const names = figureClips().map((clip) => clip.name);

  it('include everything the daily routine needs', () => {
    for (const motion of [
      'sit',
      'stand',
      'lie',
      'eat',
      'drink',
      'brush',
      'wash',
      'pick',
      'carry',
      'throw',
      'kick',
      'swim',
    ]) {
      expect(names).toContain(motion);
    }
  });

  it.each(['child', 'adult'] as const)('move only bones that exist on a %s', (build) => {
    for (const clip of figureClips(build)) {
      for (const track of clip.tracks) {
        expect(FIGURE_JOINTS).toContain(track.name.split('.')[0]);
      }
    }
  });
});

describe('things in the hand', () => {
  /** The tip of what is held at the top of a motion, as seen from the head. */
  function tipFromHead(thing: 'spoon' | 'toothbrush', motion: string, seconds: number) {
    vi.stubGlobal('document', {
      createElement: () => ({ getContext: () => null }),
    });
    const figure = new Figure(defaultChildChoices.look);
    vi.unstubAllGlobals();
    figure.hold(thing);
    const clip = figureClips().find(({ name }) => name === motion);
    if (clip === undefined) throw new Error(`no motion ${motion}`);
    new THREE.AnimationMixer(figure.model).clipAction(clip).play().getMixer().update(seconds);
    figure.model.updateMatrixWorld(true);
    const head = figure.model.getObjectByName('Head');
    const hand = figure.model.getObjectByName('ForearmR');
    if (head === undefined || hand === undefined) throw new Error('no head or hand');
    const box = new THREE.Box3();
    let tip = new THREE.Vector3(0, 0, -9);
    hand.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object.parent === hand) return;
      box.setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      if (center.z > tip.z) tip = center;
    });
    const face = head.getWorldPosition(new THREE.Vector3());
    face.y += figure.body.headRadius * 0.9;
    return { tip: tip.sub(face), radius: figure.body.headRadius };
  }

  it.each([
    ['spoon', 'eat', 0.375],
    ['toothbrush', 'brush', 0.26],
  ] as const)('the %s reaches the mouth from outside the head', (thing, motion, seconds) => {
    const { tip, radius } = tipFromHead(thing, motion, seconds);
    expect(tip.z).toBeGreaterThan(radius * 0.8);
    expect(tip.length()).toBeLessThan(radius * 1.6);
    expect(Math.abs(tip.x)).toBeLessThan(radius * 0.6);
  });
});

describe('clothes', () => {
  it('exist for every outfit', () => {
    for (const { id } of outfits) expect(outfitClothes[id]).toBeDefined();
  });

  it('never leave a child without a shirt, even at the beach', () => {
    expect(outfitClothes.swim.top).not.toBe(defaultChildChoices.look.skin);
    expect(outfitClothes.swim.longPants).toBe(false);
  });
});

describe('the people of the town', () => {
  it('has ten different people without any model to download', () => {
    const people = Object.values(cast).map((person) => JSON.stringify(person));
    expect(new Set(people).size).toBe(10);
  });

  it('gives each adult at home the family skin and eyes', () => {
    const child = defaultChildChoices.look;
    for (const { id } of guardians) {
      const adult = guardianPerson(id, child);
      expect(adult.build).toBe('adult');
      expect(adult.look.skin).toBe(child.skin);
      expect(adult.look.eyes).toBe(child.eyes);
    }
  });
});
