import * as THREE from 'three';
import { box, type Collider } from '@presentation/world/collision';
import type { WalkableSpace } from '@presentation/world/game-world';
import type { Interactable } from '@presentation/world/interactable';
import { FARM_PARK } from '@presentation/world/market-position';
import { lowPoly, solid } from '@presentation/world/materials';
import { mergeStatic } from '@presentation/world/merge-static';
import { treeRing } from '@presentation/world/scenery';
import { createPostSign, createSign } from '@presentation/world/sign';
import { fitHeight, type WorldAssets, type WorldModelId } from '@presentation/world/world-assets';
import type { Zone } from '@presentation/world/zones/zone';

const FLOOR = -5;
const PARK_RADIUS = 27;
const PEN_WIDTH = 9;
const PEN_DEPTH = 7;
const PLACE_RADIUS = 2.1;

export interface FarmAnimal {
  readonly id: string;
  readonly model: WorldModelId;
  readonly name: string;
  readonly called: string;
  readonly sound: string;
  readonly icon: string;
  readonly size: number;
  readonly x: number;
  readonly z: number;
}

export const farmAnimals: readonly FarmAnimal[] = [
  {
    id: 'cow',
    model: 'cow',
    name: 'Vaca',
    called: 'a vaca',
    sound: 'muuu',
    icon: '🐮',
    size: 1.7,
    x: -14,
    z: -2,
  },
  {
    id: 'horse',
    model: 'horse',
    name: 'Cavalo',
    called: 'o cavalo',
    sound: 'iiirrí',
    icon: '🐴',
    size: 1.9,
    x: -14,
    z: 9,
  },
  {
    id: 'sheep',
    model: 'sheep',
    name: 'Ovelha',
    called: 'a ovelha',
    sound: 'méee',
    icon: '🐑',
    size: 1.1,
    x: 14,
    z: -2,
  },
  {
    id: 'pig',
    model: 'pig',
    name: 'Porco',
    called: 'o porco',
    sound: 'oinc',
    icon: '🐷',
    size: 0.9,
    x: 14,
    z: 9,
  },
];

const binColors: readonly number[] = [0x2e86de, 0xe8433b, 0x3fae5a, 0xffc83d, 0x8a5a3b];

/** The farm: a yard around the barn, with the pens on both sides of one straight road. */
export class FarmPark implements Zone, WalkableSpace {
  readonly group = new THREE.Group();
  readonly colliders: readonly Collider[] = [];
  readonly places: readonly Interactable[] = [];
  readonly height = FLOOR;
  readonly open = true;
  readonly walkColliders: Collider[] = [];
  readonly walkPlaces: Interactable[] = [];

  constructor(private readonly assets: WorldAssets) {
    this.group.position.set(FARM_PARK.x, FLOOR, FARM_PARK.z);
    this.group.add(
      solid(new THREE.CircleGeometry(520, 40).rotateX(-Math.PI / 2), lowPoly(0x9ad67c), [0, 0, 0]),
      solid(new THREE.BoxGeometry(6, 0.02, 38), lowPoly(0xd9c08a), [0, 0.02, 6]),
      solid(new THREE.BoxGeometry(24, 0.02, 4), lowPoly(0xd9c08a), [0, 0.03, 3.5]),
      treeRing(PARK_RADIUS + 7, 34),
    );
    this.addBarn();
    for (const animal of farmAnimals) this.addPen(animal);
    this.addChicks();
    this.addBins();
    this.addPlaces();
    mergeStatic(this.group);
  }

  private at(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(FARM_PARK.x + x, FLOOR, FARM_PARK.z + z);
  }

  private block(x: number, z: number, width: number, depth: number): void {
    this.walkColliders.push(box(FARM_PARK.x + x, FARM_PARK.z + z, width, depth));
  }

  private addBarn(): void {
    const red = lowPoly(0xc4513c);
    const white = lowPoly(0xf7efe0);
    const barn = new THREE.Group();
    barn.position.set(0, 0, -15);
    barn.add(solid(new THREE.BoxGeometry(12, 5, 7), red, [0, 2.5, 0]));
    const roof = solid(new THREE.ConeGeometry(8.2, 3.2, 4), lowPoly(0x6b4a3a), [0, 6.6, 0]);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.62;
    barn.add(roof);
    barn.add(solid(new THREE.BoxGeometry(3.6, 3.4, 0.12), white, [0, 1.7, 3.52]));
    barn.add(solid(new THREE.BoxGeometry(3.2, 3, 0.14), red, [0, 1.55, 3.54]));
    for (const turn of [0.71, -0.71]) {
      const beam = solid(new THREE.BoxGeometry(4.2, 0.14, 0.16), white, [0, 1.55, 3.6]);
      beam.rotation.z = turn;
      barn.add(beam);
    }
    barn.add(solid(new THREE.BoxGeometry(1.4, 1.4, 0.12), white, [0, 4, 3.52]));
    const bale = lowPoly(0xe6c36a);
    for (const [x, z] of [
      [-7.6, 2],
      [-8.8, 1],
      [7.6, 2],
    ] as const) {
      barn.add(
        solid(new THREE.CylinderGeometry(0.8, 0.8, 1.3, 12).rotateZ(Math.PI / 2), bale, [
          x,
          0.8,
          z,
        ]),
      );
    }
    this.group.add(barn);
    this.block(0, -15, 12.4, 7.4);
    this.block(-8.2, -13.5, 3, 2.4);
    this.block(7.6, -13, 1.8, 2);
    const sign = createSign(['🌾 FAZENDA'], {
      background: '#a0643c',
      color: '#ffffff',
      width: 3.4,
      height: 0.7,
    });
    sign.position.set(0, 5.4, -11.4);
    this.group.add(sign);
  }

  /** A low fence open to nobody: the animals are near and easy to see over it. */
  private fence(x: number, z: number, width: number, depth: number): void {
    const wood = lowPoly(0xc98a4b);
    this.group.add(
      solid(new THREE.BoxGeometry(width, 0.04, depth), lowPoly(0x86c765), [x, 0.03, z]),
    );
    for (const [fx, fz, w, d] of [
      [0, -depth / 2, width, 0.14],
      [0, depth / 2, width, 0.14],
      [-width / 2, 0, 0.14, depth],
      [width / 2, 0, 0.14, depth],
    ] as const) {
      for (const y of [0.45, 0.85]) {
        this.group.add(solid(new THREE.BoxGeometry(w, 0.12, d), wood, [x + fx, y, z + fz]));
      }
    }
    for (const fx of [-0.5, -0.25, 0, 0.25, 0.5]) {
      for (const fz of [-0.5, 0.5]) {
        this.group.add(
          solid(new THREE.BoxGeometry(0.18, 1.1, 0.18), wood, [
            x + fx * width,
            0.55,
            z + fz * depth,
          ]),
        );
      }
    }
    this.block(x, z, width + 0.3, depth + 0.3);
  }

  private addPen({ model, size, x, z, name, icon }: FarmAnimal): void {
    this.fence(x, z, PEN_WIDTH, PEN_DEPTH);
    const toRoad = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    const animal = this.assets.clone(model);
    fitHeight(animal, size);
    animal.position.set(x, 0, z);
    animal.rotation.y = toRoad;
    this.group.add(animal);
    const sign = createPostSign(
      [`${icon} ${name.toUpperCase()}`],
      { background: '#a0643c', color: '#ffffff', width: 2.2, height: 0.6 },
      1.3,
    );
    const side = Math.sign(x);
    sign.position.set(x - side * (PEN_WIDTH / 2 + 0.5), 0, z + PEN_DEPTH / 2 - 0.4);
    this.group.add(sign);
  }

  private addChicks(): void {
    this.fence(-6.5, -7.2, 5, 3.2);
    for (const [x, z, turn] of [
      [-7.6, -7.6, 0.8],
      [-6.2, -6.6, 2.4],
      [-5.2, -7.8, -1],
    ] as const) {
      const chick = this.assets.clone('chick');
      fitHeight(chick, 0.45);
      chick.position.set(x, 0, z);
      chick.rotation.y = turn;
      this.group.add(chick);
    }
  }

  private addBins(): void {
    binColors.forEach((color, index) => {
      const bin = new THREE.Group();
      bin.add(solid(new THREE.CylinderGeometry(0.42, 0.36, 1.1, 14), lowPoly(color), [0, 0.55, 0]));
      bin.add(
        solid(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 14), lowPoly(color), [0, 1.16, 0]),
      );
      bin.position.set(4.2 + index * 1.15, 0, -7.6);
      this.group.add(bin);
    });
    this.block(6.5, -7.6, 6.2, 1.1);
  }

  private addPlaces(): void {
    const place = (
      id: string,
      x: number,
      z: number,
      icon: string,
      label: string,
      name: string,
    ): void => {
      const position = this.at(x, z);
      this.walkPlaces.push({
        id,
        position,
        markerPosition: position.clone().setY(FLOOR + 3.6),
        radius: PLACE_RADIUS,
        icon,
        label,
        name,
        viewFrom: 'south',
      });
    };
    for (const { id, x, z, icon, called, name } of farmAnimals) {
      place(`farm:${id}`, x - Math.sign(x) * (PEN_WIDTH / 2 + 1.4), z, icon, `Ver ${called}`, name);
    }
    place('farm:animals', -6.5, -4.2, '🐣', 'Sons da fazenda', 'Sons da fazenda');
    place('farm:recycling', 6.5, -5.4, '♻️', 'Reciclar', 'Reciclagem');
    place('farm:exit', 0, 23, '🚌', 'Voltar para casa', 'Saída');
  }

  get entrance(): THREE.Vector3 {
    return this.at(0, 19);
  }

  contains(x: number, z: number): boolean {
    return Math.hypot(x - FARM_PARK.x, z - FARM_PARK.z) < PARK_RADIUS;
  }
}
