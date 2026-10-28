import * as THREE from 'three';
import { box, circle, type Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import { lowPoly, solid } from '@presentation/world/materials';
import { createPostSign } from '@presentation/world/sign';
import { fitHeight, type WorldAssets, type WorldModelId } from '@presentation/world/world-assets';

/** A flat clearing in the west of the island where the Nature missions happen. */
export const NATURE_CAMP = { x: -70, z: -15, radius: 15, height: 4.2 } as const;

export const NaturePlace = {
  farm: 'nature:farm',
  garden: 'nature:garden',
  recycling: 'nature:recycling',
  back: 'camp:back',
} as const;

/** Where the child appears when coming through the Nature portal. */
export const campArrival = new THREE.Vector3(
  NATURE_CAMP.x + 9,
  NATURE_CAMP.height,
  NATURE_CAMP.z + 5,
);

/** Activities stand in a row on the north side; their places are in front (south). */
const ROW_Z = -7;
const PLACE_Z = -2.6;

const binColors: readonly number[] = [0x2e86de, 0xe8433b, 0x3fae5a, 0xffc83d, 0x8a5a3b];

/** The farm, the garden, the recycling bins, two tents, a campfire and the way back. */
export class NatureCamp {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly places: Interactable[] = [];
  private fire?: THREE.Mesh;

  constructor(private readonly assets: WorldAssets) {
    this.group.position.set(NATURE_CAMP.x, NATURE_CAMP.height, NATURE_CAMP.z);
    this.addGround();
    this.addFarm(-8);
    this.addGarden(2.5);
    this.addRecycling(10);
    this.addCampfire();
    this.addWayBack();
  }

  update(time: number): void {
    if (this.fire !== undefined) {
      this.fire.scale.y = 1 + Math.sin(time * 6) * 0.12;
      this.fire.rotation.y = time;
    }
  }

  /** Local camp coordinates to the world, for colliders and places. */
  private at(x: number, z: number): { x: number; z: number } {
    return { x: NATURE_CAMP.x + x, z: NATURE_CAMP.z + z };
  }

  private addPlace(id: string, x: number, icon: string, label: string, name: string): void {
    const spot = this.at(x, PLACE_Z);
    this.places.push({
      id,
      position: new THREE.Vector3(spot.x, NATURE_CAMP.height, spot.z),
      markerPosition: new THREE.Vector3(spot.x, NATURE_CAMP.height + 4, spot.z + ROW_Z - PLACE_Z),
      radius: 3.4,
      icon,
      label,
      name,
    });
  }

  private sign(text: string, color: string, x: number, z: number): void {
    const sign = createPostSign(
      [text],
      { background: color, color: '#ffffff', width: 3, height: 0.95 },
      1.4,
    );
    sign.position.set(x, 0, z);
    this.group.add(sign);
    const spot = this.at(x, z);
    this.colliders.push(circle(spot.x, spot.z, 0.5));
  }

  private addGround(): void {
    // A dirt path joining the activities.
    const path = solid(new THREE.BoxGeometry(26, 0.06, 2.6), lowPoly(0xd9c08a), [1, 0.03, PLACE_Z]);
    this.group.add(path);
    this.sign('🌳 NATUREZA', '#3fae5a', 13, 1.5);
  }

  private addFarm(x: number): void {
    const wood = lowPoly(0xc98a4b);
    const width = 10;
    const depth = 6;
    const z = ROW_Z - 1;
    // A low fence with an open front, so the animals are easy to see.
    for (const [fx, fz, w, d] of [
      [0, -depth / 2, width, 0.15],
      [-width / 2, 0, 0.15, depth],
      [width / 2, 0, 0.15, depth],
    ] as const) {
      for (const y of [0.45, 0.85]) {
        this.group.add(solid(new THREE.BoxGeometry(w, 0.12, d), wood, [x + fx, y, z + fz]));
      }
    }
    for (let i = 0; i <= 5; i += 1) {
      const px = x - width / 2 + (i * width) / 5;
      this.group.add(
        solid(new THREE.BoxGeometry(0.18, 1.1, 0.18), wood, [px, 0.55, z - depth / 2]),
      );
    }
    this.group.add(
      solid(new THREE.BoxGeometry(width, 0.04, depth), lowPoly(0x9fd66b), [x, 0.02, z]),
    );

    const herd: readonly [WorldModelId, number, number, number, number][] = [
      ['cow', -3, -1, 1.7, 0.4],
      ['horse', 0.2, -1.6, 1.9, -0.3],
      ['sheep', 3, -0.6, 1.1, 0.9],
      ['pig', -1.4, 1.4, 0.9, -0.8],
      ['chick', 2.2, 1.8, 0.45, 2.4],
    ];
    for (const [model, ax, az, height, turn] of herd) {
      const animal = this.assets.clone(model);
      fitHeight(animal, height);
      animal.position.set(x + ax, 0, z + az);
      animal.rotation.y = turn;
      this.group.add(animal);
    }
    const spot = this.at(x, z);
    this.colliders.push(box(spot.x, spot.z, width + 0.3, depth + 0.3));
    this.sign('🐮 FAZENDA', '#a0643c', x - width / 2 - 0.6, PLACE_Z - 0.8);
    this.addPlace(NaturePlace.farm, x, '🐮', 'Fazenda', 'Fazenda');
  }

  private addGarden(x: number): void {
    const wood = lowPoly(0xa86b3c);
    const soil = lowPoly(0x6b4a2f);
    for (const dx of [-2.2, 0, 2.2]) {
      this.group.add(solid(new THREE.BoxGeometry(1.8, 0.45, 3), wood, [x + dx, 0.22, ROW_Z]));
      this.group.add(solid(new THREE.BoxGeometry(1.6, 0.1, 2.8), soil, [x + dx, 0.47, ROW_Z]));
    }
    // Flowers grown, sprouts coming, and an empty bed ready for the child's seed.
    for (const [dx, model, height] of [
      [-2.2, 'flower-group', 0.9],
      [0, 'grass-tall', 0.5],
    ] as const) {
      for (const dz of [-0.8, 0.6]) {
        const plant = this.assets.clone(model);
        fitHeight(plant, height);
        plant.position.set(x + dx, 0.5, ROW_Z + dz);
        this.group.add(plant);
      }
    }
    const can = new THREE.Group();
    can.add(solid(new THREE.CylinderGeometry(0.25, 0.3, 0.5, 12), lowPoly(0x3fa9f5), [0, 0.25, 0]));
    const spout = solid(
      new THREE.CylinderGeometry(0.04, 0.06, 0.6, 8),
      lowPoly(0x3fa9f5),
      [0.38, 0.4, 0],
    );
    spout.rotation.z = -0.9;
    can.add(spout);
    can.position.set(x + 3.6, 0, ROW_Z + 1.9);
    this.group.add(can);
    const spot = this.at(x, ROW_Z);
    this.colliders.push(box(spot.x, spot.z, 6.4, 3.2));
    this.sign('🌻 HORTA', '#3fae5a', x + 1.2, PLACE_Z - 4.4);
    this.addPlace(NaturePlace.garden, x, '🌱', 'Horta', 'Horta');
  }

  private addRecycling(x: number): void {
    binColors.forEach((color, index) => {
      const bin = new THREE.Group();
      bin.add(solid(new THREE.CylinderGeometry(0.42, 0.36, 1.1, 14), lowPoly(color), [0, 0.55, 0]));
      bin.add(
        solid(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 14), lowPoly(color), [0, 1.16, 0]),
      );
      bin.add(
        solid(new THREE.TorusGeometry(0.2, 0.04, 6, 12, Math.PI), lowPoly(0x3d4a5c), [0, 1.24, 0]),
      );
      bin.position.set(x - 2.4 + index * 1.2, 0, ROW_Z + 0.5);
      this.group.add(bin);
    });
    const spot = this.at(x, ROW_Z + 0.5);
    this.colliders.push(box(spot.x, spot.z, 6.2, 1.2));
    this.sign('♻️ RECICLAR', '#2e86de', x + 3.8, PLACE_Z - 0.8);
    this.addPlace(NaturePlace.recycling, x, '♻️', 'Reciclar', 'Reciclagem');
  }

  private addCampfire(): void {
    const logs = lowPoly(0x8a5a3b);
    for (let i = 0; i < 4; i += 1) {
      const log = solid(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), logs, [-2, 0.15, 6]);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i / 4) * Math.PI;
      this.group.add(log);
    }
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      this.group.add(
        solid(new THREE.DodecahedronGeometry(0.22, 0), lowPoly(0x9c9a90), [
          -2 + Math.cos(angle) * 0.8,
          0.12,
          6 + Math.sin(angle) * 0.8,
        ]),
      );
    }
    // A calm, slowly moving flame (no flicker that could bother the eyes).
    this.fire = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.9, 8),
      lowPoly(0xffa53d, { emissive: 0xff7a00, emissiveIntensity: 1 }),
    );
    this.fire.position.set(-2, 0.6, 6);
    this.group.add(this.fire);
    const fire = this.at(-2, 6);
    this.colliders.push(circle(fire.x, fire.z, 1));

    const tentColors = [0xff7a6b, 0x3fa9f5];
    tentColors.forEach((color, index) => {
      const tent = solid(new THREE.ConeGeometry(1.6, 2.2, 4), lowPoly(color), [
        -8 + index * 3.8,
        1.1,
        9,
      ]);
      tent.rotation.y = Math.PI / 4;
      this.group.add(tent);
      const door = solid(new THREE.ConeGeometry(0.55, 1.1, 3), lowPoly(0x2d3142), [
        -8 + index * 3.8,
        0.55,
        7.95,
      ]);
      this.group.add(door);
      const spot = this.at(-8 + index * 3.8, 9);
      this.colliders.push(circle(spot.x, spot.z, 1.4));
    });
  }

  private addWayBack(): void {
    const arch = new THREE.Group();
    const frame = lowPoly(0x6cc070, { emissive: 0x6cc070, emissiveIntensity: 0.3 });
    for (const dx of [-1.4, 1.4])
      arch.add(solid(new THREE.BoxGeometry(0.5, 2.4, 0.5), frame, [dx, 1.2, 0]));
    arch.add(solid(new THREE.TorusGeometry(1.4, 0.28, 8, 16, Math.PI), frame, [0, 2.4, 0]));
    arch.position.set(12, 0, 8);
    arch.rotation.y = -Math.PI / 2;
    this.group.add(arch);
    for (const dz of [-1.4, 1.4]) {
      const spot = this.at(12, 8 + dz);
      this.colliders.push(circle(spot.x, spot.z, 0.4));
    }
    const spot = this.at(10.5, 8);
    this.places.push({
      id: NaturePlace.back,
      position: new THREE.Vector3(spot.x, NATURE_CAMP.height, spot.z),
      markerPosition: new THREE.Vector3(spot.x, NATURE_CAMP.height + 4, spot.z),
      radius: 2.6,
      icon: '🌀',
      label: 'Voltar aos portais',
      name: 'Portal de volta',
    });
  }
}
