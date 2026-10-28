import * as THREE from 'three';
import { box, circle, type Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import { lowPoly, solid } from '@presentation/world/materials';
import {
  bench,
  bus,
  busStop,
  fountain,
  fruitCrate,
  house,
  shop,
  streetLamp,
  trafficLight,
  type TrafficLight,
} from '@presentation/world/props';
import { createSign } from '@presentation/world/sign';

export const CITY = { x: 0, z: 0, radius: 50, height: 1.5 } as const;

/** Ids of the places in town; the game decides what each one does. */
export const CityPlace = {
  home: 'home',
  market: 'market',
  bakery: 'bakery',
  busStop: 'bus-stop',
} as const;

const ROAD_WIDTH = 7;
const SIDEWALK = 3;
/** Buildings start this far from the middle of the main road. */
const LOT_START = ROAD_WIDTH / 2 + SIDEWALK + 0.5;
const CROSSWALK_X = 5.2;

/**
 * A small, calm town: one main street, a side street to the portal hill, the
 * player's home, the market, the bakery and the bus stop.
 */
export class City {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly places: Interactable[] = [];
  private readonly trafficLights: TrafficLight[] = [];
  private fountainWater?: THREE.Mesh;

  constructor() {
    this.group.position.y = CITY.height;
    this.addStreets();
    this.addBuildings();
    this.addStreetLife();
  }

  update(time: number): void {
    for (const light of this.trafficLights) light.update(time);
    if (this.fountainWater !== undefined)
      this.fountainWater.position.y = 0.62 + Math.sin(time * 2) * 0.03;
  }

  private place(object: THREE.Object3D, x: number, z: number, facingSouth = true): THREE.Object3D {
    object.position.set(x, 0, z);
    object.rotation.y = facingSouth ? 0 : Math.PI;
    this.group.add(object);
    return object;
  }

  private addStreets(): void {
    const asphalt = lowPoly(0x5d6475);
    const sidewalk = lowPoly(0xe3ddd0);
    const paint = lowPoly(0xffffff);
    const length = CITY.radius * 2;

    this.group.add(solid(new THREE.BoxGeometry(length, 0.08, ROAD_WIDTH), asphalt, [0, 0.04, 0]));
    this.group.add(
      solid(new THREE.BoxGeometry(ROAD_WIDTH, 0.08, CITY.radius), asphalt, [
        0,
        0.04,
        -CITY.radius / 2,
      ]),
    );

    for (const side of [-1, 1]) {
      const z = side * (ROAD_WIDTH / 2 + SIDEWALK / 2);
      this.group.add(solid(new THREE.BoxGeometry(length, 0.16, SIDEWALK), sidewalk, [0, 0.08, z]));
    }
    for (const side of [-1, 1]) {
      const x = side * (ROAD_WIDTH / 2 + SIDEWALK / 2);
      const sideLength = CITY.radius - ROAD_WIDTH / 2 - SIDEWALK;
      this.group.add(
        solid(new THREE.BoxGeometry(SIDEWALK, 0.16, sideLength), sidewalk, [
          x,
          0.08,
          -ROAD_WIDTH / 2 - SIDEWALK - sideLength / 2,
        ]),
      );
    }

    for (let x = -length / 2 + 2; x < length / 2; x += 4) {
      if (Math.abs(x) < ROAD_WIDTH) continue;
      this.group.add(solid(new THREE.BoxGeometry(1.8, 0.1, 0.25), paint, [x, 0.06, 0]));
    }
    for (let z = -ROAD_WIDTH; z > -CITY.radius; z -= 4) {
      this.group.add(solid(new THREE.BoxGeometry(0.25, 0.1, 1.8), paint, [0, 0.06, z]));
    }
    // Crosswalk between the side street and the market.
    for (let i = 0; i < 6; i += 1) {
      this.group.add(
        solid(new THREE.BoxGeometry(0.7, 0.1, 5.6), paint, [CROSSWALK_X + i * 1.2, 0.07, 0]),
      );
    }
  }

  private addBuilding(
    object: THREE.Group,
    x: number,
    width: number,
    depth: number,
    south: boolean,
  ): { z: number; doorZ: number } {
    const z = south ? LOT_START + depth / 2 : -(LOT_START + depth / 2);
    this.place(object, x, z, !south);
    const top = CITY.height + new THREE.Box3().setFromObject(object).max.y;
    this.colliders.push(box(x, z, width + 0.4, depth + 0.4, top));
    return { z, doorZ: south ? LOT_START - 1.6 : -(LOT_START - 1.6) };
  }

  private addPlace(
    id: string,
    x: number,
    doorZ: number,
    markerHeight: number,
    icon: string,
    label: string,
    name: string,
  ): void {
    this.places.push({
      id,
      position: new THREE.Vector3(x, CITY.height, doorZ),
      markerPosition: new THREE.Vector3(x, CITY.height + markerHeight, doorZ),
      radius: 3.6,
      icon,
      label,
      name,
    });
  }

  private addSign(
    lines: readonly string[],
    background: string,
    x: number,
    y: number,
    z: number,
    south: boolean,
    width = 5,
  ): void {
    const sign = createSign(lines, { background, color: '#ffffff', width, height: 1.3 });
    sign.position.set(x, y, z);
    sign.rotation.y = south ? Math.PI : 0;
    this.group.add(sign);
  }

  private addBuildings(): void {
    // Player's home (south side, faces the street).
    const home = this.addBuilding(
      house({ width: 9, depth: 8, height: 5, wall: 0xfff1d6, roof: 0xe8604c, door: 0x4d8fd6 }),
      -22,
      9,
      8,
      true,
    );
    this.addSign(['🏠 Minha casa'], '#e8604c', -22, 6.2, home.z - 4.12, true, 4.2);
    this.addPlace(CityPlace.home, -22, home.doorZ, 5.8, '🏠', 'Guarda-roupa', 'Minha casa');

    const market = this.addBuilding(
      shop({ width: 12, depth: 9, height: 5.5, wall: 0x7fd1ae, stripes: [0xe8504c, 0xffffff] }),
      18,
      12,
      9,
      true,
    );
    this.addSign(['🍎 MERCADO'], '#2f9e6e', 18, 6.6, market.z - 4.62, true, 6);
    this.addPlace(CityPlace.market, 18, market.doorZ, 6.2, '🛒', 'Entrar no mercado', 'Mercado');
    for (const [dx, fruit] of [
      [-4.6, 0xe8433b],
      [4.6, 0xffd23f],
    ] as const) {
      this.place(fruitCrate(fruit), 18 + dx, LOT_START + 0.2);
      this.colliders.push(box(18 + dx, LOT_START + 0.2, 1.3, 0.9));
    }

    const bakery = this.addBuilding(
      shop({ width: 9, depth: 8, height: 5, wall: 0xf6c28b, stripes: [0x8a5a3b, 0xfff1d6] }),
      20,
      9,
      8,
      false,
    );
    this.addSign(['🍞 PADARIA'], '#a0643c', 20, 6.1, bakery.z + 4.12, false, 5);
    this.addPlace(CityPlace.bakery, 20, bakery.doorZ, 6, '🥐', 'Padaria', 'Padaria');

    const homes: readonly [number, boolean, number, number][] = [
      [-38, true, 0xcfe8ff, 0x4d6fd6],
      [2, true, 0xffe3ec, 0x9b6bf2],
      [36, true, 0xfff6c9, 0x3fae5a],
      [-36, false, 0xe2f7d9, 0xe8904c],
      [-18, false, 0xf9e0ff, 0xe8604c],
      [38, false, 0xd9f2ff, 0xe8b14c],
    ];
    for (const [x, south, wall, roof] of homes) {
      this.addBuilding(
        house({ width: 8, depth: 7, height: 4.4, wall, roof, door: 0x8a5a3b }),
        x,
        8,
        7,
        south,
      );
    }
  }

  private addStreetLife(): void {
    const stop = busStop();
    // North side of the street: the shelter's back wall faces away from the road.
    this.place(stop, -12, -(ROAD_WIDTH / 2 + 1.6));
    this.colliders.push(box(-12, -(ROAD_WIDTH / 2 + 2.2), 4.4, 0.4));
    this.addSign(['🚌 ÔNIBUS'], '#2e86de', -12 + 2.6, 3.6, -(ROAD_WIDTH / 2 + 1.2), false, 2.6);
    this.places.push({
      id: CityPlace.busStop,
      position: new THREE.Vector3(-12, CITY.height, -(ROAD_WIDTH / 2 + 0.5)),
      markerPosition: new THREE.Vector3(-12, CITY.height + 4.6, -(ROAD_WIDTH / 2 + 0.5)),
      radius: 3.4,
      icon: '🚌',
      label: 'Ponto de ônibus',
      name: 'Ônibus',
    });

    const parkedBus = bus();
    this.place(parkedBus, -20, -1.7);
    this.colliders.push(box(-20, -1.7, 8.4, 3, CITY.height + 3.3));

    const { group, water } = fountain();
    this.place(group, -9, 14);
    this.fountainWater = water;
    this.colliders.push(circle(-9, 14, 2.9));
    for (const [x, z, south] of [
      [-9, 18.4, false],
      [-9, 9.6, true],
    ] as const) {
      this.place(bench(), x, z, south);
      this.colliders.push(box(x, z, 2.3, 0.8));
    }

    for (const [x, z] of [
      [CROSSWALK_X - 1.4, -4.2],
      [CROSSWALK_X - 1.4, 4.2],
    ] as const) {
      const light = trafficLight();
      this.place(light.group, x, z, z < 0);
      this.trafficLights.push(light);
      this.colliders.push(circle(x, z, 0.3));
    }

    const lampZ = ROAD_WIDTH / 2 + SIDEWALK - 0.4;
    for (const x of [-44, -30, -14, 4, 28, 44]) {
      for (const side of [-1, 1]) {
        if (side === -1 && Math.abs(x + 12) < 4) continue;
        this.place(streetLamp(), x, side * lampZ);
        this.colliders.push(circle(x, side * lampZ, 0.25));
      }
    }

    const treeTrunk = lowPoly(0x8a5a3b);
    const treeTop = lowPoly(0x55c25a);
    for (const [x, z] of [
      [-30, 9],
      [-14, 9],
      [8, 9],
      [28, 9],
      [-28, -9],
      [8, -9],
      [30, -9],
      [-6, -20],
      [6, -30],
      [-6, -40],
    ] as const) {
      const tree = new THREE.Group();
      tree.add(solid(new THREE.CylinderGeometry(0.2, 0.3, 2, 6), treeTrunk, [0, 1, 0]));
      tree.add(solid(new THREE.IcosahedronGeometry(1.4, 0), treeTop, [0, 2.8, 0]));
      this.place(tree, x, z);
      this.colliders.push(circle(x, z, 0.45));
    }
  }
}

/** Keeps the city free of wild trees and rocks. */
export const isInsideCity = (x: number, z: number, margin = 0): boolean =>
  Math.hypot(x - CITY.x, z - CITY.z) < CITY.radius + margin;
