import * as THREE from 'three';
import { animals, type AnimalId } from '@domain/zoo/animals';
import { circle, box, type Collider } from '@presentation/world/collision';
import type { WalkableSpace } from '@presentation/world/game-world';
import type { Interactable } from '@presentation/world/interactable';
import { ZOO_PARK } from '@presentation/world/market-position';
import { lowPoly, solid } from '@presentation/world/materials';
import { mergeStatic } from '@presentation/world/merge-static';
import { createPostSign } from '@presentation/world/sign';
import { ZooAnimal } from '@presentation/world/zoo-animals';
import type { Zone } from '@presentation/world/zones/zone';

const FLOOR = -5;
const PARK_RADIUS = 26;
const PEN_DISTANCE = 19;
const PEN_RADIUS = 5;
/** The child stands here, on the path, in front of each pen. */
const VIEW_DISTANCE = 12.6;
const SLOTS = animals.length + 1;
const PEN_COLORS: Readonly<Record<AnimalId, number>> = {
  lion: 0xe6cf8f,
  elephant: 0xd9c98a,
  giraffe: 0xe6d99a,
  monkey: 0x9fcf8a,
  zebra: 0xdccb8e,
  penguin: 0xdcecf5,
  bear: 0xa3c98a,
  hippo: 0x9ccfe0,
  flamingo: 0xa8dbe6,
  turtle: 0xa8d59a,
};

/** The zoo: a round path with the pens around it, so nobody can get lost in a dead end. */
export class ZooPark implements Zone, WalkableSpace {
  readonly group = new THREE.Group();
  readonly colliders: readonly Collider[] = [];
  readonly places: readonly Interactable[] = [];
  readonly height = FLOOR;
  readonly walkColliders: Collider[] = [];
  readonly walkPlaces: Interactable[] = [];
  private readonly actors = new Map<AnimalId, ZooAnimal>();

  constructor() {
    this.group.position.set(ZOO_PARK.x, FLOOR, ZOO_PARK.z);
    this.group.add(
      solid(new THREE.CircleGeometry(60, 40).rotateX(-Math.PI / 2), lowPoly(0x8fd07a), [0, 0, 0]),
      solid(
        new THREE.RingGeometry(9, 14.2, 48).rotateX(-Math.PI / 2),
        lowPoly(0xe8dcc0),
        [0, 0.02, 0],
      ),
      solid(new THREE.BoxGeometry(5, 0.02, 14), lowPoly(0xe8dcc0), [0, 0.03, 19]),
    );
    animals.forEach((animal, index) => {
      this.addPen(animal.id, animal.name, animal.icon, index);
    });
    this.addCenter();
    this.addPlaces();
    const moving = [...this.actors.values()].map((actor) => actor.group);
    mergeStatic(this.group, moving);
  }

  private at(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(ZOO_PARK.x + x, FLOOR, ZOO_PARK.z + z);
  }

  /** Clockwise from the gate, which has the south for itself. */
  private angleOf(index: number): number {
    return Math.PI / 2 + ((index + 1) / SLOTS) * Math.PI * 2;
  }

  private addPen(id: AnimalId, name: string, icon: string, index: number): void {
    const angle = this.angleOf(index);
    const x = Math.cos(angle) * PEN_DISTANCE;
    const z = Math.sin(angle) * PEN_DISTANCE;
    this.group.add(
      solid(new THREE.CylinderGeometry(PEN_RADIUS, PEN_RADIUS, 0.06, 24), lowPoly(PEN_COLORS[id]), [
        x,
        0.04,
        z,
      ]),
      solid(
        new THREE.TorusGeometry(PEN_RADIUS, 0.07, 6, 28).rotateX(Math.PI / 2),
        lowPoly(0x8a5a3b),
        [x, 0.8, z],
      ),
    );
    for (let post = 0; post < 10; post += 1) {
      const around = (post / 10) * Math.PI * 2;
      this.group.add(
        solid(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), lowPoly(0x8a5a3b), [
          x + Math.cos(around) * PEN_RADIUS,
          0.4,
          z + Math.sin(around) * PEN_RADIUS,
        ]),
      );
    }
    this.walkColliders.push(circle(ZOO_PARK.x + x, ZOO_PARK.z + z, PEN_RADIUS));
    const actor = new ZooAnimal(id, index);
    actor.group.position.set(x, 0.07, z);
    actor.group.rotation.y = Math.atan2(-x, -z);
    this.group.add(actor.group);
    this.actors.set(id, actor);
    const signAt = (PEN_DISTANCE - PEN_RADIUS - 0.5) / PEN_DISTANCE;
    const sign = createPostSign(
      [`${icon} ${name}`],
      { background: '#3fae5a', color: '#ffffff', width: 2.8, height: 0.8 },
      1.3,
    );
    sign.position.set(x * signAt + Math.sin(angle) * 2, 0, z * signAt - Math.cos(angle) * 2);
    sign.rotation.y = Math.atan2(-x, -z);
    this.group.add(sign);
  }

  private addCenter(): void {
    // A snack bar and a bathroom in the middle of the circle.
    this.group.add(
      solid(new THREE.BoxGeometry(5, 2.6, 2.4), lowPoly(0xffd6a5), [-3, 1.3, -2]),
      solid(new THREE.BoxGeometry(5.6, 0.25, 3), lowPoly(0xe8604c), [-3, 2.7, -2]),
      solid(new THREE.BoxGeometry(3, 2.4, 2.4), lowPoly(0xbde0fe), [4, 1.2, -2]),
    );
    this.walkColliders.push(
      box(ZOO_PARK.x - 3, ZOO_PARK.z - 2, 5, 2.4),
      box(ZOO_PARK.x + 4, ZOO_PARK.z - 2, 3, 2.4),
    );
  }

  private addPlaces(): void {
    animals.forEach((animal, index) => {
      const angle = this.angleOf(index);
      const position = this.at(Math.cos(angle) * VIEW_DISTANCE, Math.sin(angle) * VIEW_DISTANCE);
      this.walkPlaces.push({
        id: `zoo:${animal.id}`,
        position,
        markerPosition: position.clone().setY(FLOOR + 4),
        radius: 1.9,
        icon: animal.icon,
        label: `Ver ${animal.called}`,
        name: animal.name,
      });
    });
    const simple = (
      id: string,
      x: number,
      z: number,
      icon: string,
      label: string,
      name: string,
    ) => {
      const position = this.at(x, z);
      this.walkPlaces.push({
        id,
        position,
        markerPosition: position.clone().setY(FLOOR + 3.6),
        radius: 1.6,
        icon,
        label,
        name,
      });
    };
    simple('zoo:snack', -3, -0.2, '🍿', 'Lanchonete', 'Lanchonete');
    simple('zoo:toilet', 4, -0.2, '🚻', 'Banheiro', 'Banheiro');
    simple('zoo:exit', 0, 24.5, '🚌', 'Voltar para casa', 'Saída');
  }

  get entrance(): THREE.Vector3 {
    return this.at(0, 21);
  }

  contains(x: number, z: number): boolean {
    return Math.hypot(x - ZOO_PARK.x, z - ZOO_PARK.z) < PARK_RADIUS;
  }

  actor(id: AnimalId): ZooAnimal | undefined {
    return this.actors.get(id);
  }

  update(time: number): void {
    for (const actor of this.actors.values()) actor.update(time);
  }
}
