import type { Routine, Spot } from '@domain/people/routine';
import type { CastMember } from '@presentation/actors/cast';
import type { Ground, Player } from '@presentation/actors/player';
import { circle, type Collider } from '@presentation/world/collision';

/** How close someone must be to answer a greeting. */
const GREET_RANGE = 4.5;
const BODY_RADIUS = 0.45;

export interface Person {
  readonly character: Player;
  readonly reply: string;
  readonly route?: readonly Spot[];
  routine?: Routine;
}

export interface Neighbor {
  readonly member: CastMember;
  readonly facing: number;
  /** Walked back and forth. The first stop is where this person starts. */
  readonly route: readonly Spot[];
}

/** Who lives around here. Their routes run along open ground, away from the crossing. */
export const neighbors: readonly Neighbor[] = [
  {
    member: 'gardener',
    facing: Math.PI,
    route: [
      { x: -15.8, z: 7.4 },
      { x: -22.5, z: 7.4 },
    ],
  },
  {
    member: 'neighbor',
    facing: 0,
    route: [
      { x: 24.5, z: -8.2 },
      { x: 30.5, z: -8.2 },
    ],
  },
];

export const colliderOf = (x: number, z: number): Collider => circle(x, z, BODY_RADIUS);

/** The closest person who can hear a greeting from there. */
export function nearestPerson(
  people: readonly Person[],
  position: { readonly x: number; readonly z: number },
): Person | undefined {
  let closest: Person | undefined;
  let best = GREET_RANGE;
  for (const person of people) {
    const { x, z } = person.character.position;
    const distance = Math.hypot(x - position.x, z - position.z);
    if (distance <= best) {
      best = distance;
      closest = person;
    }
  }
  return closest;
}

/** The ground for people who stand still: their own body must not push them away. */
export const standingGround = (ground: Ground): Ground => ({
  heightAt: (x, z) => ground.heightAt(x, z),
  isWalkable: () => true,
  colliders: [],
});
