import { describe, expect, it } from 'vitest';
import { defaultChildChoices, guardians, outfits } from '@domain/avatar/child';
import { cast, guardianPerson } from '@presentation/actors/cast';
import { FIGURE_JOINTS, figureClips, outfitClothes } from '@presentation/actors/child-figure';

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
