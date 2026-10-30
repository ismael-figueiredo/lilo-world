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
  gazebo,
  slide,
  streetLamp,
  swings,
  trafficLight,
  type TrafficLight,
} from '@presentation/world/props';
import { RoadSafety } from '@presentation/world/road-safety';
import {
  crossingRect,
  planStreets,
  zebraBars,
  type Crossing,
  type Road,
} from '@presentation/world/street-plan';
import type { CrosswalkZone } from '@presentation/world/crosswalk';
import { createPostSign, createSign } from '@presentation/world/sign';
import { LearningStations } from '@presentation/world/stations';
import {
  fitFootprint,
  fitHeight,
  type Recolor,
  type WorldAssets,
  type WorldModelId,
} from '@presentation/world/world-assets';

export const CITY = { x: 0, z: 0, radius: 50, height: 1.5 } as const;

/** The newer neighborhood south of the main street: an avenue, houses, the square. */
export const SOUTH_DISTRICT = { x: 0, z: 48, radius: 32 } as const;

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
/** Middle of the crossing with a traffic light, by the market. */
const CROSSWALK_X = 8.5;
const CROSSWALK_WIDTH = 4.4;

/** Streets running down from the main street to the avenue (x of their middle). */
const WEST_STREET_X = -31.5;
const EAST_STREET_X = 28.5;
const AVENUE_Z = 36;
const AVENUE = { width: 6, sidewalk: 2 } as const;
/** Front line of the houses on the avenue's south side. */
const AVENUE_LOT_START = AVENUE_Z + AVENUE.width / 2 + AVENUE.sidewalk + 0.5;
/** The town square, between the main street's lots and the avenue. */
export const SQUARE = { x: 2, z: 24, radius: 6.8 } as const;

const ROADS: readonly Road[] = [
  { axis: 'x', at: 0, from: -CITY.radius, to: CITY.radius, width: ROAD_WIDTH, sidewalk: SIDEWALK },
  { axis: 'z', at: 0, from: -CITY.radius, to: 0, width: ROAD_WIDTH, sidewalk: SIDEWALK },
  { axis: 'x', at: AVENUE_Z, from: -36, to: 36, ...AVENUE },
  { axis: 'z', at: WEST_STREET_X, from: 0, to: AVENUE_Z, width: 5, sidewalk: 1.5 },
  { axis: 'z', at: EAST_STREET_X, from: 0, to: AVENUE_Z, width: 5, sidewalk: 1.5 },
];

const [MAIN_STREET, NORTH_STREET, AVENUE_ROAD, WEST_STREET, EAST_STREET] = ROADS as readonly [
  Road,
  Road,
  Road,
  Road,
  Road,
];

/** Every painted crossing in town. Only the one by the market has a traffic light. */
const CROSSINGS: readonly Crossing[] = [
  { road: MAIN_STREET, at: CROSSWALK_X, width: CROSSWALK_WIDTH, signal: true },
  { road: MAIN_STREET, at: -8, width: CROSSWALK_WIDTH },
  { road: NORTH_STREET, at: -9, width: 4 },
  { road: AVENUE_ROAD, at: -13, width: 3.6 },
  { road: AVENUE_ROAD, at: 13, width: 3.6 },
  { road: WEST_STREET, at: 15, width: 3.2 },
  { road: EAST_STREET, at: 15, width: 3.2 },
];

/** The crossing with a traffic light, used by the "cross the street" mission. */
export const CROSSWALK: CrosswalkZone = {
  minX: CROSSWALK_X - CROSSWALK_WIDTH / 2,
  maxX: CROSSWALK_X + CROSSWALK_WIDTH / 2,
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
 * A small, calm town: the main street, a side street to the portal hill, the
 * player's home, the market, the bakery and the bus stop, and to the south an
 * avenue with more houses, the town square and a playground.
 */
export class City {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly places: Interactable[] = [];
  private readonly trafficLights: TrafficLight[] = [];
  private fountainWater?: THREE.Mesh;
  private readonly stations = new LearningStations(CITY.height);
  private readonly plan = planStreets(ROADS, CROSSINGS.map(crossingRect));
  /** Follows the child near the streets. */
  readonly roadSafety = new RoadSafety(
    this.plan.asphalt,
    CROSSINGS.map((crossing) => ({
      rect: crossingRect(crossing),
      signal: crossing.signal === true,
      across: crossing.road.axis === 'x' ? ('z' as const) : ('x' as const),
    })),
  );

  constructor(private readonly assets: WorldAssets) {
    this.group.position.y = CITY.height;
    this.addStreets();
    this.addBuildings();
    this.addStreetLife();
    this.addSouthDistrict();
    this.group.add(this.stations.group);
    this.colliders.push(...this.stations.colliders);
    this.places.push(...this.stations.places);
  }

  /** The shared traffic light cycle right now. */
  phase: TrafficPhase = trafficPhase(0);

  update(time: number): void {
    this.phase = trafficPhase(time);
    for (const light of this.trafficLights) light.update(this.phase);
    this.stations.update(time);
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
    const plan = this.plan;
    for (const piece of plan.asphalt) {
      // Side streets sit a hair higher, so touching ends never flicker.
      const lift = piece.road * 0.002;
      this.group.add(
        solid(new THREE.BoxGeometry(piece.width, 0.08, piece.depth), asphalt, [
          piece.x,
          0.04 + lift,
          piece.z,
        ]),
      );
    }
    for (const piece of plan.sidewalks) {
      this.group.add(
        solid(new THREE.BoxGeometry(piece.width, 0.16, piece.depth), sidewalk, [
          piece.x,
          0.08,
          piece.z,
        ]),
      );
    }
    for (const dash of plan.dashes) {
      this.group.add(
        solid(new THREE.BoxGeometry(dash.width, 0.1, dash.depth), paint, [dash.x, 0.06, dash.z]),
      );
    }
    for (const crossing of CROSSINGS) {
      for (const bar of zebraBars(crossing)) {
        this.group.add(
          solid(new THREE.BoxGeometry(bar.width, 0.1, bar.depth), paint, [bar.x, 0.07, bar.z]),
        );
      }
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
  private addBuilding(
    object: THREE.Object3D,
    x: number,
    south: boolean,
    setback = 0,
    frontLine = LOT_START,
  ): Lot {
    const bounds = new THREE.Box3().setFromObject(object);
    const frontDistance = frontLine + setback;
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
      [-42, true, 0x9fd0ff, 0x4d6fd6],
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
      ['car', -40, 2.3, 1],
      ['taxi', 41, 2.3, 1],
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
      [CROSSWALK_X - CROSSWALK_WIDTH / 2 - 0.9, -4.2],
      [CROSSWALK_X - CROSSWALK_WIDTH / 2 - 0.9, 4.2],
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
      name: 'Faixa',
    });

    const lampZ = ROAD_WIDTH / 2 + SIDEWALK - 0.4;
    for (const x of [-44, -24, -14, 4, 22, 44]) {
      for (const side of [-1, 1]) {
        if (side === -1 && Math.abs(x + 12) < 4) continue;
        this.place(streetLamp(), x, side * lampZ);
        this.colliders.push(circle(x, side * lampZ, 0.25));
      }
    }

    const treeModels: readonly WorldModelId[] = ['tree-round', 'tree-twin', 'tree-tall'];
    // None by the crosswalk: the child must see the walking figure across the street.
    const streetTrees: readonly (readonly [number, number])[] = [
      [-14, 9],
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

  /** The avenue's houses, the town square with its bandstand, and a playground. */
  private addSouthDistrict(): void {
    const homes: readonly [number, number, number][] = [
      [-26, 0xffd6a5, 0x2e86de],
      [-13, 0xc8f2c2, 0xe8604c],
      [0, 0xffc8dd, 0x3fae5a],
      [13, 0xbde0fe, 0xf08c00],
      [26, 0xfff1a8, 0x9b6bf2],
    ];
    homes.forEach(([x, wall, roof], index) => {
      const model = HOUSE_MODELS[(index + 1) % HOUSE_MODELS.length] ?? 'house-gable';
      const lot = this.addBuilding(
        this.house(model, wall, roof, 8, 7),
        x,
        true,
        0,
        AVENUE_LOT_START,
      );
      const flowers = this.assets.clone(index % 2 === 0 ? 'bush-flowers' : 'flower-group');
      fitHeight(flowers, 0.9);
      this.place(flowers, x + 3, lot.front - 0.5);
    });

    // Lamps and trees on the avenue, between the houses.
    const walkZ = AVENUE_Z + AVENUE.width / 2 + AVENUE.sidewalk / 2;
    for (const x of [-32.5, -19.5, -6.5, 6.5, 19.5, 32.5]) {
      this.place(streetLamp(), x, walkZ);
      this.colliders.push(circle(x, walkZ, 0.25));
    }
    const avenueTrees: readonly (readonly [number, number])[] = [
      [-19.5, AVENUE_Z - 4.2],
      [19.5, AVENUE_Z - 4.2],
      [-23, 21],
      [-14, 28],
      [20, 30],
    ];
    avenueTrees.forEach(([x, z], index) => {
      const tree = this.assets.clone(index % 2 === 0 ? 'tree-twin' : 'tree-round');
      fitHeight(tree, 5.4);
      this.place(tree, x, z);
      tree.rotation.y = index * 2.1;
      this.colliders.push(circle(x, z, 0.45));
    });

    // The square: a round paved plaza, the bandstand, benches facing it and flower beds.
    const { x: sx, z: sz, radius } = SQUARE;
    const paving = solid(new THREE.CylinderGeometry(radius, radius, 0.1, 40), lowPoly(0xeadfc8), [
      sx,
      0.05,
      sz,
    ]);
    this.group.add(paving);
    const ring = solid(new THREE.TorusGeometry(radius, 0.18, 6, 48), lowPoly(0xcfc6b4), [
      sx,
      0.1,
      sz,
    ]);
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);
    this.place(gazebo(), sx, sz);
    this.colliders.push(circle(sx, sz, 3.6));
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = sx + Math.cos(angle) * (radius - 1.2);
      const z = sz + Math.sin(angle) * (radius - 1.2);
      const seat = bench();
      this.place(seat, x, z);
      // Benches look at the bandstand.
      seat.rotation.y = Math.atan2(sx - x, sz - z);
      this.colliders.push(circle(x, z, 1));
      const bed = this.assets.clone(i % 2 === 0 ? 'flower-group' : 'bush-flowers');
      fitHeight(bed, 1);
      const bedAngle = angle + Math.PI / 4;
      this.place(
        bed,
        sx + Math.cos(bedAngle) * (radius + 1.2),
        sz + Math.sin(bedAngle) * (radius + 1.2),
      );
    }
    for (const [dx, dz] of [
      [-radius - 1.5, 0],
      [radius + 1.5, 0],
    ] as const) {
      this.place(streetLamp(), sx + dx, sz + dz);
      this.colliders.push(circle(sx + dx, sz + dz, 0.25));
    }
    const squareSign = createPostSign(
      ['🎪 PRAÇA'],
      { background: '#e8604c', color: '#ffffff', width: 2.6, height: 0.95 },
      1.4,
    );
    this.place(squareSign, sx + 4, sz - radius - 1, false);
    this.colliders.push(circle(sx + 4, sz - radius - 1, 0.5));

    // Playground beside the square, on soft rubber floor.
    const play = { x: 17.5, z: 22 };
    this.group.add(
      solid(new THREE.BoxGeometry(9, 0.08, 9), lowPoly(0x7ec8a3), [play.x, 0.04, play.z]),
    );
    this.place(slide(), play.x - 2.2, play.z, true);
    this.colliders.push(box(play.x - 2.2, play.z - 0.3, 1.6, 3.6));
    const swingSet = swings();
    this.place(swingSet, play.x + 2.4, play.z + 1);
    swingSet.rotation.y = Math.PI / 2;
    this.colliders.push(box(play.x + 2.4, play.z + 1, 1.2, 4));
  }
}

/** Keeps the city (and its southern neighborhood) free of wild trees and rocks. */
export const isInsideCity = (x: number, z: number, margin = 0): boolean =>
  Math.hypot(x - CITY.x, z - CITY.z) < CITY.radius + margin ||
  Math.hypot(x - SOUTH_DISTRICT.x, z - SOUTH_DISTRICT.z) < SOUTH_DISTRICT.radius + margin;
