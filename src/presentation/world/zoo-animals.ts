import * as THREE from 'three';
import type { AnimalId } from '@domain/zoo/animals';
import { lowPoly, solid } from '@presentation/world/materials';

const ball = new THREE.SphereGeometry(1, 10, 8);
const cube = new THREE.BoxGeometry(1, 1, 1);
const leg = new THREE.CylinderGeometry(1, 1, 1, 6);

type V3 = readonly [number, number, number];

const blob = (color: number, size: V3, at: V3): THREE.Mesh => {
  const mesh = solid(ball, lowPoly(color), at);
  mesh.scale.set(...size);
  return mesh;
};

const block = (color: number, size: V3, at: V3): THREE.Mesh => {
  const mesh = solid(cube, lowPoly(color), at);
  mesh.scale.set(...size);
  return mesh;
};

const post = (color: number, radius: number, height: number, at: V3): THREE.Mesh => {
  const mesh = solid(leg, lowPoly(color), at);
  mesh.scale.set(radius, height, radius);
  return mesh;
};

function fourLegs(color: number, x: number, z: number, height: number, radius: number) {
  return [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => post(color, radius, height, [sx * x, height / 2, sz * z])),
  );
}

const eyes = (x: number, y: number, z: number): THREE.Mesh[] =>
  [-1, 1].map((side) => blob(0x241a16, [0.05, 0.05, 0.05], [side * x, y, z]));

/** Each one is its own shape, read at a glance. Nothing to download. */
const builders: Readonly<Record<AnimalId, () => readonly THREE.Object3D[]>> = {
  lion: () => [
    ...fourLegs(0xd9a85c, 0.45, 0.8, 0.8, 0.13),
    blob(0xd9a85c, [0.6, 0.5, 1.05], [0, 1, 0]),
    blob(0x9a5a28, [0.62, 0.62, 0.45], [0, 1.35, 1]),
    blob(0xe0b46a, [0.38, 0.38, 0.38], [0, 1.35, 1.3]),
    ...eyes(0.16, 1.45, 1.64),
    post(0x9a5a28, 0.05, 1, [0, 0.8, -1.3]),
  ],
  elephant: () => [
    ...fourLegs(0x8f96a3, 0.6, 0.9, 1.1, 0.28),
    blob(0x8f96a3, [1, 0.95, 1.45], [0, 1.7, 0]),
    blob(0x8f96a3, [0.62, 0.62, 0.6], [0, 2.1, 1.45]),
    blob(0xa7adb8, [0.12, 0.65, 0.5], [-0.72, 2.1, 1.25]),
    blob(0xa7adb8, [0.12, 0.65, 0.5], [0.72, 2.1, 1.25]),
    post(0x8f96a3, 0.13, 1.5, [0, 1.25, 1.95]),
    ...eyes(0.34, 2.3, 1.95),
  ],
  giraffe: () => [
    ...fourLegs(0xe8c070, 0.32, 0.55, 1.5, 0.1),
    blob(0xe8c070, [0.48, 0.48, 0.85], [0, 1.75, 0]),
    post(0xe8c070, 0.16, 2, [0, 2.9, 0.6]),
    blob(0xe8c070, [0.26, 0.24, 0.45], [0, 4, 0.8]),
    ...eyes(0.16, 4.1, 1),
    blob(0x9a5a28, [0.2, 0.05, 0.2], [0.3, 2, 0.2]),
    blob(0x9a5a28, [0.2, 0.05, 0.2], [-0.3, 1.7, -0.3]),
    blob(0x9a5a28, [0.05, 0.16, 0.16], [0.16, 2.9, 0.6]),
  ],
  monkey: () => [
    blob(0x7a5230, [0.36, 0.45, 0.32], [0, 0.65, 0]),
    blob(0x7a5230, [0.3, 0.3, 0.3], [0, 1.25, 0.05]),
    blob(0xe0b48a, [0.2, 0.17, 0.12], [0, 1.2, 0.27]),
    ...eyes(0.09, 1.33, 0.3),
    post(0x7a5230, 0.06, 0.65, [-0.42, 0.65, 0.1]),
    post(0x7a5230, 0.06, 0.65, [0.42, 0.65, 0.1]),
    post(0x7a5230, 0.08, 0.4, [-0.16, 0.2, 0]),
    post(0x7a5230, 0.08, 0.4, [0.16, 0.2, 0]),
  ],
  zebra: () => [
    ...fourLegs(0xf4f1ea, 0.3, 0.65, 0.9, 0.09),
    blob(0xf4f1ea, [0.42, 0.45, 0.95], [0, 1.15, 0]),
    blob(0xf4f1ea, [0.22, 0.26, 0.5], [0, 1.75, 0.95]),
    ...[-0.5, -0.2, 0.1, 0.4].map((z) => block(0x2a2a2a, [0.86, 0.04, 0.1], [0, 1.45, z])),
    ...[-0.6, -0.25, 0.1, 0.45].map((z) => block(0x2a2a2a, [0.86, 0.5, 0.08], [0, 1.1, z])),
    ...eyes(0.14, 1.82, 1.2),
  ],
  penguin: () => [
    blob(0x2a2f3a, [0.36, 0.56, 0.33], [0, 0.65, 0]),
    blob(0xf4f1ea, [0.26, 0.42, 0.14], [0, 0.6, 0.24]),
    blob(0x2a2f3a, [0.25, 0.25, 0.25], [0, 1.28, 0]),
    block(0xffa63c, [0.12, 0.07, 0.2], [0, 1.26, 0.28]),
    block(0xffa63c, [0.15, 0.05, 0.28], [-0.14, 0.05, 0.1]),
    block(0xffa63c, [0.15, 0.05, 0.28], [0.14, 0.05, 0.1]),
    ...eyes(0.09, 1.36, 0.2),
  ],
  bear: () => [
    ...fourLegs(0x6b4427, 0.42, 0.65, 0.6, 0.2),
    blob(0x6b4427, [0.68, 0.65, 1], [0, 1, 0]),
    blob(0x6b4427, [0.42, 0.42, 0.42], [0, 1.45, 0.95]),
    blob(0x6b4427, [0.13, 0.13, 0.08], [-0.3, 1.82, 0.9]),
    blob(0x6b4427, [0.13, 0.13, 0.08], [0.3, 1.82, 0.9]),
    blob(0xc9a27a, [0.18, 0.14, 0.14], [0, 1.36, 1.32]),
    ...eyes(0.16, 1.55, 1.3),
  ],
  hippo: () => [
    ...fourLegs(0x8a7f9a, 0.5, 0.75, 0.45, 0.2),
    blob(0x8a7f9a, [0.8, 0.65, 1.3], [0, 0.85, 0]),
    blob(0x9a8faa, [0.55, 0.42, 0.55], [0, 0.95, 1.4]),
    ...eyes(0.25, 1.3, 1.3),
  ],
  flamingo: () => [
    post(0xf08fb5, 0.04, 1.2, [0.08, 0.6, 0]),
    blob(0xf08fb5, [0.32, 0.26, 0.48], [0, 1.35, 0]),
    post(0xf08fb5, 0.05, 0.85, [0, 1.8, 0.35]),
    blob(0xf08fb5, [0.13, 0.13, 0.15], [0, 2.25, 0.4]),
    block(0x2a2a2a, [0.06, 0.07, 0.2], [0, 2.18, 0.58]),
    ...eyes(0.09, 2.3, 0.48),
  ],
  turtle: () => [
    ...fourLegs(0x7fb069, 0.3, 0.4, 0.15, 0.09),
    blob(0x4f8a4a, [0.55, 0.3, 0.68], [0, 0.32, 0]),
    blob(0x7fb069, [0.16, 0.14, 0.2], [0, 0.3, 0.78]),
    ...eyes(0.08, 0.36, 0.93),
  ],
};

export type AnimalAction = 'idle' | 'eat' | 'sleep';

/** An animal of the zoo: it breathes, eats and rests. */
export class ZooAnimal {
  readonly group = new THREE.Group();
  private action: AnimalAction = 'idle';

  constructor(
    id: AnimalId,
    private readonly phase: number,
  ) {
    this.group.add(...builders[id]());
  }

  act(action: AnimalAction): void {
    this.action = action;
  }

  update(time: number): void {
    const breath = 1 + Math.sin(time * 1.6 + this.phase) * 0.012;
    this.group.scale.y = this.action === 'sleep' ? 0.72 : breath;
    this.group.rotation.x = this.action === 'eat' ? 0.12 + Math.sin(time * 5) * 0.05 : 0;
  }
}
