import * as THREE from 'three';
import { trafficPhase, type TrafficPhase } from '@domain/city/traffic-light';
import { box, circle, type Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import { lowPoly, solid } from '@presentation/world/materials';
import {
  bench,
  bus,
  busStop,
  fountain,
  streetLamp,
  trafficLight,
  type TrafficLight,
} from '@presentation/world/props';
import type { CrosswalkZone } from '@presentation/world/crosswalk';
import { createPostSign, createSign } from '@presentation/world/sign';
import {
  fitFootprint,
  fitHeight,
  type Recolor,
  type WorldAssets,
  type WorldModelId,
} from '@presentation/world/world-assets';

export const CITY = { x: 0, z: 0, radius: 50, height: 1.5 } as const;

/** Ids of the places in town; the game decides what each one does. */
export const CityPlace = {
  home: 'home',
  market: 'market',
  bakery: 'bakery',
  busStop: 'bus-stop',
  crosswalk: 'crosswalk',
} as const;

const ROAD_WIDTH = 7;
const SIDEWALK = 3;
/** Buildings start this far from the middle of the main road. */
const LOT_START = ROAD_WIDTH / 2 + SIDEWALK + 0.5;
const CROSSWALK_X = 5.2;

/** The painted crossing between the side street and the market. */
export const CROSSWALK: CrosswalkZone = {
  minX: CROSSWALK_X - 0.35,
  maxX: CROSSWALK_X + 5 * 1.2 + 0.35,
  roadHalfWidth: ROAD_WIDTH / 2,
  curbDepth: SIDEWALK,
};

/** Where a building ended up: its front faces the main street. */
interface Lot {
  /** Street-side face of the building (world z inside the city group). */
  readonly front: number;
  /** Spot on the sidewalk in front of the door. */
  readonly doorZ: number;
  readonly height: number;
}

const HOUSE_MODELS: readonly WorldModelId[] = ['house-gable', 'house-porch'];

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

  constructor(private readonly assets: WorldAssets) {
    this.group.position.y = CITY.height;
    this.addStreets();
    this.addBuildings();
    this.addStreetLife();
  }

  /** The shared traffic light cycle right now. */
  phase: TrafficPhase = trafficPhase(0);

  update(time: number): void {
    this.phase = trafficPhase(time);
    for (const light of this.trafficLights) light.update(this.phase);
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

  /** A house model with its own wall and roof colors, sized to a lot. */
  private house(model: WorldModelId, wall: number, roof: number, width: number, depth: number) {
    const object = this.assets.clone(model, { White: wall, Grey: roof });
    fitFootprint(object, width, depth);
    return object;
  }

  /** A shop model (they face local -z, so it is turned around), sized by height. */
  private shop(model: WorldModelId, recolor: Recolor, height: number) {
    const group = new THREE.Group();
    const inner = this.assets.clone(model, recolor);
    inner.rotation.y = Math.PI;
    group.add(inner);
    fitHeight(group, height);
    return group;
  }

  /**
   * Puts a building (facing local +z) on its lot with the front `setback`
   * meters behind the sidewalk, and blocks it for walking and the camera.
   */
  private addBuilding(object: THREE.Object3D, x: number, south: boolean, setback = 0): Lot {
    const bounds = new THREE.Box3().setFromObject(object);
    const frontDistance = LOT_START + setback;
    const offsetX = (bounds.min.x + bounds.max.x) / 2;
    const centerZ = (bounds.min.z + bounds.max.z) / 2;
    // South-side buildings are turned around to face the street (local x and z flip).
    const z = south ? frontDistance + bounds.max.z : -frontDistance - bounds.max.z;
    this.place(object, south ? x + offsetX : x - offsetX, z, !south);
    const width = bounds.max.x - bounds.min.x;
    const depth = bounds.max.z - bounds.min.z;
    this.colliders.push(
      box(
        x,
        south ? z - centerZ : z + centerZ,
        width + 0.3,
        depth + 0.3,
        CITY.height + bounds.max.y,
      ),
    );
    return {
      front: south ? frontDistance : -frontDistance,
      doorZ: south ? frontDistance - 1.6 : -(frontDistance - 1.6),
      height: bounds.max.y,
    };
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

  /** A sign on the facade, just in front of the building's street side. */
  private addFacadeSign(
    lines: readonly string[],
    background: string,
    x: number,
    y: number,
    lot: Lot,
    width = 5,
  ): void {
    const sign = createSign(lines, { background, color: '#ffffff', width, height: 1.3 });
    const south = lot.front > 0;
    sign.position.set(x, y, lot.front + (south ? -0.25 : 0.25));
    sign.rotation.y = south ? Math.PI : 0;
    this.group.add(sign);
  }

  private addBuildings(): void {
    // Player's home (south side, faces the street), with a sign in the front yard.
    const home = this.addBuilding(this.house('house-gable', 0xffe0a8, 0xe8604c, 9, 8), -22, true);
    const homeSign = createPostSign(
      ['🏠 Minha casa'],
      {
        background: '#e8604c',
        color: '#ffffff',
        width: 3.6,
        height: 1.1,
      },
      1.2,
    );
    this.place(homeSign, -26.4, home.front - 0.6, false);
    this.colliders.push(box(-26.4, home.front - 0.6, 3, 0.4));
    this.addPlace(
      CityPlace.home,
      -22,
      home.doorZ,
      home.height + 0.8,
      '🏠',
      'Guarda-roupa',
      'Minha casa',
    );

    const market = this.addBuilding(
      this.shop('shop-wide', { _defaultMat: 0x8fdcb8, roof: 0xe8504c, border: 0x2f9e6e }, 6.2),
      18,
      true,
      2.4,
    );
    this.addFacadeSign(['🍎 MERCADO'], '#2f9e6e', 18, market.height * 0.62, market, 6);
    this.addPlace(
      CityPlace.market,
      18,
      market.doorZ,
      market.height + 0.6,
      '🛒',
      'Entrar no mercado',
      'Mercado',
    );
    for (const dx of [-4.4, 4.4]) {
      const stall = this.assets.clone('market-stall');
      fitFootprint(stall, 3.4, 2.6);
      // Stalls face the sidewalk, beside the door.
      this.place(stall, 18 + dx, LOT_START + 1.2, false);
      this.colliders.push(box(18 + dx, LOT_START + 1.2, 3.4, 2.2));
    }

    const bakery = this.addBuilding(
      this.shop('shop-tall', { _defaultMat: 0xf6c28b, roof: 0x8a5a3b, border: 0xa0643c }, 8),
      20,
      false,
    );
    this.addFacadeSign(['🍞 PADARIA'], '#a0643c', 20, 3.3, bakery, 4.4);
    this.addPlace(
      CityPlace.bakery,
      20,
      bakery.doorZ,
      bakery.height + 0.6,
      '🥐',
      'Padaria',
      'Padaria',
    );

    const homes: readonly [number, boolean, number, number][] = [
      [-38, true, 0x9fd0ff, 0x4d6fd6],
      [2, true, 0xffb8cf, 0x9b6bf2],
      [36, true, 0xffe27a, 0x3fae5a],
      [-36, false, 0xb6ec9c, 0xe8904c],
      [-18, false, 0xe3b8ff, 0xe8604c],
      [38, false, 0xa8e6f0, 0xe8b14c],
    ];
    homes.forEach(([x, south, wall, roof], index) => {
      const model = HOUSE_MODELS[index % HOUSE_MODELS.length] ?? 'house-gable';
      const lot = this.addBuilding(this.house(model, wall, roof, 8, 7), x, south);
      // A little garden by the door.
      for (const dx of [-3, 3]) {
        const flowers = this.assets.clone(dx < 0 ? 'flower-group' : 'bush-flowers');
        fitHeight(flowers, 0.9);
        this.place(flowers, x + dx, lot.front + (south ? -0.5 : 0.5));
      }
    });
  }

  private addStreetLife(): void {
    const stop = busStop();
    // North side of the street: the shelter's back wall faces away from the road.
    this.place(stop, -12, -(ROAD_WIDTH / 2 + 1.6));
    this.colliders.push(box(-12, -(ROAD_WIDTH / 2 + 2.2), 4.4, 0.4));
    const stopSign = createPostSign(
      ['🚌 ÔNIBUS'],
      { background: '#2e86de', color: '#ffffff', width: 2.6, height: 1 },
      2.2,
    );
    this.place(stopSign, -12 + 2.9, -(ROAD_WIDTH / 2 + 0.9));
    this.colliders.push(circle(-12 + 2.9, -(ROAD_WIDTH / 2 + 0.9), 0.4));
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

    // Cars parked by the curb, along the street.
    const parked: readonly [WorldModelId, number, number, number][] = [
      ['car', -33, 2.3, 1],
      ['taxi', 29, 2.3, 1],
      ['suv', -31, -2.3, -1],
      ['car', 33, -2.3, -1],
    ];
    for (const [model, x, z, direction] of parked) {
      const car = this.assets.clone(model, model === 'car' && x > 0 ? { Blue: 0xe8604c } : {});
      car.scale.setScalar(1.1);
      this.place(car, x, z);
      car.rotation.y = (direction * Math.PI) / 2;
      this.colliders.push(box(x, z, 4.8, 2.3, CITY.height + 1.6));
    }

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
    const crossingX = (CROSSWALK.minX + CROSSWALK.maxX) / 2;
    const curbZ = ROAD_WIDTH / 2 + 1.4;
    this.places.push({
      id: CityPlace.crosswalk,
      position: new THREE.Vector3(crossingX, CITY.height, curbZ),
      markerPosition: new THREE.Vector3(crossingX, CITY.height + 3, curbZ),
      radius: 2.6,
      icon: '🚦',
      label: 'Atravessar a rua',
      name: 'Faixa de pedestres',
    });

    const lampZ = ROAD_WIDTH / 2 + SIDEWALK - 0.4;
    for (const x of [-44, -30, -14, 4, 28, 44]) {
      for (const side of [-1, 1]) {
        if (side === -1 && Math.abs(x + 12) < 4) continue;
        this.place(streetLamp(), x, side * lampZ);
        this.colliders.push(circle(x, side * lampZ, 0.25));
      }
    }

    const treeModels: readonly WorldModelId[] = ['tree-round', 'tree-twin', 'tree-tall'];
    // None by the crosswalk: the child must see the walking figure across the street.
    const streetTrees: readonly (readonly [number, number])[] = [
      [-30, 9],
      [-14, 9],
      [28, 9],
      [-28, -9],
      [30, -9],
      [-6, -20],
      [6, -30],
      [-6, -40],
    ];
    streetTrees.forEach(([x, z], index) => {
      const tree = this.assets.clone(treeModels[index % treeModels.length] ?? 'tree-round');
      fitHeight(tree, 5.2 + (index % 3) * 0.5);
      this.place(tree, x, z);
      tree.rotation.y = index * 1.7;
      this.colliders.push(circle(x, z, 0.45));
    });
  }
}

/** Keeps the city free of wild trees and rocks. */
export const isInsideCity = (x: number, z: number, margin = 0): boolean =>
  Math.hypot(x - CITY.x, z - CITY.z) < CITY.radius + margin;
