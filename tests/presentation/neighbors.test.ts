import { describe, expect, it } from 'vitest';
import type { Player } from '@presentation/actors/player';
import { isInsideAny } from '@presentation/world/collision';
import { nearestPerson, standingGround, type Person } from '@presentation/world/neighbors';

const person = (x: number, z: number, reply: string): Person => ({
  character: { position: { x, z } } as unknown as Player,
  reply,
});

describe('greeting people', () => {
  const people = [person(0, 0, 'near'), person(3, 0, 'farther'), person(40, 0, 'far')];

  it('answers from the closest person in range', () => {
    expect(nearestPerson(people, { x: 1, z: 0 })?.reply).toBe('near');
    expect(nearestPerson(people, { x: 2.6, z: 0 })?.reply).toBe('farther');
  });

  it('finds nobody when no one is close', () => {
    expect(nearestPerson(people, { x: 20, z: 0 })).toBeUndefined();
    expect(nearestPerson([], { x: 0, z: 0 })).toBeUndefined();
  });

  it('keeps people who stand still from pushing themselves away', () => {
    const ground = standingGround({
      heightAt: () => 2,
      isWalkable: () => false,
      colliders: [{ kind: 'circle', x: 0, z: 0, radius: 1 } as never],
    });
    expect(ground.colliders).toEqual([]);
    expect(ground.isWalkable(0, 0)).toBe(true);
    expect(ground.heightAt(0, 0)).toBe(2);
  });
});

describe('places to jump', () => {
  const areas = [{ x: 10, z: 10, radius: 5 }];

  it('counts only the inside of an area', () => {
    expect(isInsideAny(areas, 12, 10)).toBe(true);
    expect(isInsideAny(areas, 20, 10)).toBe(false);
    expect(isInsideAny([], 0, 0)).toBe(false);
  });
});
