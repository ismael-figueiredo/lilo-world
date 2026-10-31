import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { SchoolThing } from '@domain/day/day-plan';
import type { Phase, Weather } from '@domain/day/weather';
import { buildAccessory } from '@presentation/actors/wardrobe-meshes';
import { box, type Collider } from '@presentation/world/collision';
import { paintFrost, paintRain } from '@presentation/world/window-view';
import { routeInside, type HouseSpot } from '@presentation/world/house-plan';
import type { Interactable } from '@presentation/world/interactable';
import { pictureOf, StudyDesk } from '@presentation/world/study-desk';
import { lowPoly, solid } from '@presentation/world/materials';
import { mergeStatic } from '@presentation/world/merge-static';
import type { DryArea } from '@presentation/world/weather-effects';

/** The house stands far beyond the sea, where it is never seen from the island. */
export const HOUSE = { x: 460, z: 0 } as const;

export type HouseThing =
  | 'bed'
  | 'table'
  | 'sink'
  | 'shower'
  | 'wardrobe'
  | 'desk'
  | 'door'
  | 'fridge'
  | 'stove'
  | 'calm'
  | 'decor';

export type FoodId = 'bread' | 'fruit' | 'cereal' | 'egg';

const HALF_WIDTH = 8;
const HALF_DEPTH = 6;
const WALL = 2.6;
/** Walls between the camera and the room are low, as in a dollhouse. */
const LOW_WALL = 0.7;
/** Every wall between two rooms, low enough for the camera to see over. */
const ROOM_WALL = 1.2;
const WIND_LEAN = 0.16;
const WIND_SWAY = 0.05;
const discColors: Readonly<Record<Phase, number>> = {
  morning: 0xffe27a,
  noon: 0xffe27a,
  afternoon: 0xffd96a,
  dusk: 0xffa766,
  night: 0xf2f4ff,
};
/** A real opening in the back wall: what is outside is the world itself. */
const WINDOW_GAP = { left: -7.2, right: -5.2, bottom: 1.25, top: 2.35 } as const;
const THICK = 0.2;
const BITES = 3;

/** Where the child stands to use each thing, and the direction they face. */
export const standSpots: Readonly<Record<HouseThing, HouseSpot>> = {
  bed: { x: -4.7, z: -4.3, facing: -Math.PI / 2 },
  table: { x: 3.8, z: 2.6, facing: 0 },
  sink: { x: 2.2, z: -4.2, facing: Math.PI },
  shower: { x: 6.5, z: -2.5, facing: Math.PI },
  wardrobe: { x: -2.2, z: -4.1, facing: Math.PI },
  desk: { x: -6.6, z: -1.5, facing: 0 },
  door: { x: -4, z: 5, facing: 0 },
  fridge: { x: 6, z: 2, facing: 2.4 },
  stove: { x: 3.3, z: 1.5, facing: Math.PI },
  calm: { x: -3.6, z: 2.4, facing: 0 },
  decor: { x: -3.2, z: -2.4, facing: Math.PI },
};

const looks: Readonly<Record<HouseThing, { icon: string; label: string; name: string }>> = {
  bed: { icon: '🛏️', label: 'Cama', name: 'Cama' },
  table: { icon: '🍽️', label: 'Mesa', name: 'Mesa' },
  sink: { icon: '🪥', label: 'Pia', name: 'Pia' },
  shower: { icon: '🚿', label: 'Chuveiro', name: 'Chuveiro' },
  wardrobe: { icon: '👕', label: 'Armário', name: 'Armário' },
  desk: { icon: '✏️', label: 'Escrivaninha', name: 'Escrivaninha' },
  door: { icon: '🚪', label: 'Porta da rua', name: 'Porta da rua' },
  fridge: { icon: '🧊', label: 'Geladeira', name: 'Geladeira' },
  stove: { icon: '🍳', label: 'Fogão', name: 'Fogão' },
  calm: { icon: '🧸', label: 'Cantinho calmo', name: 'Cantinho calmo' },
  decor: { icon: '🖼️', label: 'Enfeitar o quarto', name: 'Enfeites do quarto' },
};

export type MirrorId = 'bedroom' | 'bathroom';

const mirrors: Readonly<Record<MirrorId, { width: number; height: number; x: number; y: number }>> =
  {
    bedroom: { width: 1.1, height: 2.1, x: -3.8, y: 1.25 },
    bathroom: { width: 1.2, height: 1.1, x: 2.2, y: 1.6 },
  };

export const placeOf = (thing: HouseThing): string => `house:${thing}`;

export const thingOf = (placeId: string): HouseThing | undefined =>
  (Object.keys(standSpots) as HouseThing[]).find((thing) => placeOf(thing) === placeId);

const schoolThingColors: Readonly<Record<SchoolThing, number>> = {
  notebook: 0x3f8fd6,
  pencil: 0xffc93c,
  book: 0xe8604c,
  lunchbox: 0x3fae5a,
  sneakers: 0xf4f1ea,
  paints: 0x9b6bf2,
};

/** A surface that can light up, separate from the shared materials. */
const glowing = (color: number): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.85,
    emissive: 0xffc93c,
    emissiveIntensity: 0,
  });

/**
 * The child's house: bedroom and bathroom at the back, living room and kitchen
 * in front, without a roof and with low walls toward the camera, so the camera
 * sees every room and never goes through a wall.
 */
export class House {
  readonly group = new THREE.Group();
  readonly floor = 0;
  readonly colliders: Collider[] = [];
  readonly places: Interactable[] = [];

  private readonly surfaces = new Map<HouseThing, THREE.MeshStandardMaterial>();
  private readonly trail: THREE.Mesh[] = [];
  private readonly meal = new THREE.Group();
  private readonly desk = new THREE.Group();
  private readonly fridgeDoor = new THREE.Group();
  private readonly fridgeInside = new THREE.Group();
  private readonly cooking = new THREE.Group();
  private readonly decor = new THREE.Group();
  private readonly calmGlow = new THREE.PointLight(0xffd9a0, 8, 7, 1.6);
  readonly study = new StudyDesk(this.desk);
  private readonly sinkWater: THREE.Mesh;
  private readonly showerWater: THREE.Mesh;
  private readonly curtain: THREE.Mesh;
  private readonly sunbeam: THREE.Mesh;
  private windowPane!: THREE.Mesh;
  private rainPane!: THREE.Mesh;
  private readonly drops = paintRain();
  private readonly frost = paintFrost();
  private rainy = false;
  private windy = false;
  private calmWind = false;
  /** Seen from the window: the sun or the moon, the clouds, and the tree the wind bends. */
  private readonly skyDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 24),
    new THREE.MeshBasicMaterial({ color: discColors.morning }),
  );
  private readonly cloudSurface = new THREE.MeshBasicMaterial({ color: 0xe6ebf0 });
  private readonly clouds = new THREE.Group();
  private readonly bentTree = new THREE.Group();
  private mirror: Reflector | undefined;
  private readonly backpack = new THREE.Group();
  /** Faces the back rooms only, so a mirror shows a room and not the garden behind the low wall. */
  private readonly wallInMirror = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_WIDTH * 2, 6),
    lowPoly(0xfdf6ea),
  );
  private lit: HouseThing | undefined;

  constructor() {
    this.group.position.set(HOUSE.x, this.floor, HOUSE.z);
    this.addGrounds();
    this.addWalls();
    this.addBedroom();
    this.addBathroom();
    this.addLivingRoom();
    this.addKitchen();
    this.sinkWater = this.water(0.05, 0.45, [2.2, 1.28, -5.25]);
    this.showerWater = this.water(0.5, 1.9, [6.6, 1.1, -4.5]);
    this.curtain = solid(
      new THREE.BoxGeometry(2.4, 2.2, 0.06),
      lowPoly(0x6fc3e8),
      [6.6, 1.25, -3.1],
    );
    this.group.add(this.curtain);
    this.sunbeam = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 5).rotateX(-0.7),
      new THREE.MeshBasicMaterial({
        color: 0xffe9a8,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.sunbeam.position.set(-6.2, 1.5, -4.1);
    this.sunbeam.visible = false;
    this.group.add(this.sunbeam);
    this.group.add(
      this.meal,
      this.desk,
      this.study.group,
      this.fridgeInside,
      this.cooking,
      this.decor,
      this.backpack,
    );

    for (const thing of Object.keys(standSpots) as HouseThing[]) this.addPlace(thing);
    mergeStatic(this.group, [
      this.meal,
      this.desk,
      this.study.group,
      this.fridgeDoor,
      this.fridgeInside,
      this.cooking,
      this.decor,
      this.backpack,
      this.bentTree,
      this.skyDisc,
      this.clouds,
      this.sinkWater,
      this.showerWater,
      this.curtain,
      this.sunbeam,
      this.windowPane,
      this.rainPane,
    ]);
    this.setCurtain(false);
    this.setWater(undefined);
  }

  /** Under the walls nothing falls: the rain stays around the house. */
  get roofed(): DryArea {
    return { x: HOUSE.x, z: HOUSE.z, halfX: HALF_WIDTH + 0.2, halfZ: HALF_DEPTH + 0.2 };
  }

  contains(x: number, z: number): boolean {
    const dx = x - HOUSE.x;
    const dz = z - HOUSE.z;
    return Math.abs(dx) <= HALF_WIDTH + 1 && Math.abs(dz) <= HALF_DEPTH + 1;
  }

  /** A spot of the house in world coordinates. */
  world(spot: HouseSpot | { readonly x: number; readonly z: number }): THREE.Vector3 {
    return new THREE.Vector3(HOUSE.x + spot.x, this.floor, HOUSE.z + spot.z);
  }

  /** A place of the world in the coordinates of the house. */
  local(position: THREE.Vector3): { x: number; z: number } {
    return { x: position.x - HOUSE.x, z: position.z - HOUSE.z };
  }

  /** One thing shines, with footprints of light leading to it. */
  show(thing: HouseThing | undefined, from?: THREE.Vector3): void {
    this.lit = thing;
    for (const [other, surface] of this.surfaces) {
      if (other !== thing) surface.emissiveIntensity = 0;
    }
    for (const dot of this.trail) dot.visible = false;
    if (thing === undefined || from === undefined) return;
    const spot = standSpots[thing];
    const dots = routeInside({ x: from.x - HOUSE.x, z: from.z - HOUSE.z }, spot);
    dots.forEach((point, index) => {
      this.trailDot(index).position.set(point.x, 0.05, point.z);
    });
  }

  update(time: number): void {
    const shine = 0.35 + Math.sin(time * 3) * 0.25;
    if (this.rainy) this.drops.offset.y = (time * 0.6) % 1;
    const sway = this.calmWind ? 0 : Math.sin(time * 2.4) * WIND_SWAY;
    this.bentTree.rotation.z = this.windy ? WIND_LEAN + sway : 0;
    if (this.lit !== undefined) {
      const surface = this.surfaces.get(this.lit);
      if (surface !== undefined) surface.emissiveIntensity = shine;
    }
    this.trail.forEach((dot, index) => {
      (dot.material as THREE.MeshBasicMaterial).opacity =
        0.45 + Math.sin(time * 4 - index * 0.7) * 0.3;
    });
  }

  /** Through the glass the child sees the real weather, and on rainy days the drops too. */
  setWindow(phase: Phase, weather: Weather): void {
    const clear = weather === 'sunny' || weather === 'wind';
    const lit = phase !== 'night';
    this.skyDisc.visible = clear || (!lit && weather === 'cold');
    this.skyDisc.position.y = phase === 'dusk' ? 4 : 7;
    this.skyDisc.material.color.setHex(discColors[phase]);
    this.clouds.visible = !clear && lit;
    this.cloudSurface.color.setHex(weather === 'rain' ? 0x8c98a8 : 0xe6ebf0);
    this.windy = weather === 'wind';
    this.rainy = weather === 'rain';
    this.rainPane.visible = this.rainy || weather === 'cold';
    (this.rainPane.material as THREE.MeshBasicMaterial).map = this.rainy ? this.drops : this.frost;
  }

  /** In a calm setting the wind leans the tree and leaves it still. */
  setCalmWind(calm: boolean): void {
    this.calmWind = calm;
  }

  /** The backpack on the floor by the desk, or nothing when it is somewhere else. */
  setBackpack(color: number | undefined): void {
    this.backpack.clear();
    if (color === undefined) return;
    const model = buildAccessory('backpack', color);
    if (model === undefined) return;
    model.object.scale.setScalar(0.46);
    model.object.position.set(-5, 0.2, -0.5);
    model.object.rotation.y = Math.PI;
    this.backpack.add(model.object);
  }

  setMorningLight(on: boolean): void {
    this.sunbeam.visible = on;
  }

  setCurtain(closed: boolean): void {
    this.curtain.scale.x = closed ? 1 : 0.18;
    this.curtain.position.x = closed ? 6.6 : 7.6;
  }

  setWater(running: 'sink' | 'shower' | undefined): void {
    this.sinkWater.visible = running === 'sink';
    this.showerWater.visible = running === 'shower';
  }

  /** A real reflection, drawn only while someone looks at it. */
  setMirror(where: MirrorId | undefined): void {
    this.mirror?.removeFromParent();
    this.mirror?.dispose();
    this.mirror = undefined;
    this.wallInMirror.removeFromParent();
    if (where === undefined) return;
    const { width, height, x, y } = mirrors[where];
    this.mirror = new Reflector(new THREE.PlaneGeometry(width, height), {
      textureWidth: 256,
      textureHeight: 512,
      color: 0xdfeeff,
    });
    this.mirror.position.set(x, y, -5.8);
    this.wallInMirror.position.set(0, ROOM_WALL + 3, 0);
    this.wallInMirror.rotation.y = Math.PI;
    this.group.add(this.mirror, this.wallInMirror);
  }

  /** The chosen breakfast on the table: it goes away bite by bite. */
  serve(food: FoodId): void {
    this.meal.clear();
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.26, 0.05, 16),
      lowPoly(0xffffff),
    );
    plate.position.set(3.8, 0.8, 3.45);
    this.meal.add(plate);
    const color = { bread: 0xd9a35c, fruit: 0xe8604c, cereal: 0xe9c46a, egg: 0xffe27a }[food];
    for (let bite = 0; bite < BITES; bite += 1) {
      const piece = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), lowPoly(color));
      piece.position.set(3.8 + (bite - 1) * 0.15, 0.88, 3.45 + (bite === 1 ? 0.09 : -0.05));
      this.meal.add(piece);
    }
  }

  /** Takes one piece of food away. */
  /** Opens the fridge on what is there, with an empty place for each missing thing. */
  openFridge(icons: readonly string[], missing: number): void {
    this.fridgeInside.clear();
    const shown = [...icons, ...Array.from({ length: missing }, () => '❓')];
    shown.forEach((pictogram, index) => {
      const item = pictureOf({ pictogram });
      item.scale.setScalar(1.7);
      item.position.set(7 + (index % 2) * 0.6, 0.5 + Math.floor(index / 2) * 0.66, 1.08);
      this.fridgeInside.add(item);
    });
    this.fridgeDoor.rotation.y = 1.9;
  }

  closeFridge(): void {
    this.fridgeInside.clear();
    this.fridgeDoor.rotation.y = 0;
  }

  /** What is in the pot, while it cooks. */
  setCooking(icon: string | undefined): void {
    this.cooking.clear();
    if (icon === undefined) return;
    const dish = pictureOf({ pictogram: icon });
    dish.position.set(3.3, 1.28, 0.55);
    this.cooking.add(dish);
  }

  /** Lunch on the table, for the child and the adult. */
  serveDish(icon: string): void {
    this.meal.clear();
    const plate = (x: number): void => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.26, 0.05, 16),
        lowPoly(0xffffff),
      );
      mesh.position.set(x, 0.8, 3.45);
      this.meal.add(mesh);
    };
    plate(2.9);
    plate(3.8);
    const theirs = pictureOf({ pictogram: icon });
    theirs.position.set(2.9, 0.72, 3.45);
    this.meal.add(theirs);
    for (let bite = 0; bite < BITES; bite += 1) {
      const food = pictureOf({ pictogram: icon });
      food.scale.setScalar(0.7);
      food.position.set(3.8 + (bite - 1) * 0.15, 0.74, 3.45);
      this.meal.add(food);
    }
  }

  bite(): void {
    this.meal.children.at(-1)?.removeFromParent();
  }

  clearTable(): void {
    this.meal.clear();
  }

  /** What is on the desk today. */
  layOut(things: readonly SchoolThing[]): void {
    this.desk.clear();
    things.forEach((thing, index) => {
      const item = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.08, 0.2),
        lowPoly(schoolThingColors[thing]),
      );
      item.name = thing;
      item.position.set(-7.2 + index * 0.35, 0.88, -0.6);
      this.desk.add(item);
    });
  }

  takeFromDesk(thing: SchoolThing): void {
    this.desk.getObjectByName(thing)?.removeFromParent();
  }

  private trailDot(index: number): THREE.Mesh {
    let dot = this.trail[index];
    if (dot === undefined) {
      dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.2, 12).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, depthWrite: false }),
      );
      this.trail[index] = dot;
      this.group.add(dot);
    }
    dot.visible = true;
    return dot;
  }

  private water(radius: number, height: number, at: readonly [number, number, number]): THREE.Mesh {
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.55 }),
    );
    water.position.set(...at);
    this.group.add(water);
    return water;
  }

  private addPlace(thing: HouseThing): void {
    const spot = standSpots[thing];
    const look = looks[thing];
    this.places.push({
      id: placeOf(thing),
      position: this.world(spot),
      markerPosition: this.world(spot).setY(WALL + 0.6),
      radius: 1.6,
      icon: look.icon,
      label: look.label,
      name: look.name,
    });
  }

  private piece(
    size: readonly [number, number, number],
    color: number | THREE.Material,
    at: readonly [number, number, number],
  ): THREE.Mesh {
    const surface = typeof color === 'number' ? lowPoly(color) : color;
    const mesh = solid(new THREE.BoxGeometry(...size), surface, at);
    this.group.add(mesh);
    return mesh;
  }

  /** Furniture the child cannot walk through. */
  private block(x: number, z: number, width: number, depth: number): void {
    this.colliders.push(box(HOUSE.x + x, HOUSE.z + z, width, depth));
  }

  private shining(thing: HouseThing, color: number): THREE.MeshStandardMaterial {
    const surface = glowing(color);
    this.surfaces.set(thing, surface);
    return surface;
  }

  /** The same street as outside, seen over the walls and through the window. */
  private addNeighborhood(): void {
    const ground = (size: readonly [number, number], color: number, z: number, y: number) => {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(...size).rotateX(-Math.PI / 2),
        lowPoly(color),
      );
      strip.position.set(0, y, z);
      strip.receiveShadow = true;
      this.group.add(strip);
    };
    ground([140, 2.4], 0xcfc8b6, 8.6, 0);
    ground([140, 9], 0x2f3a55, 14.3, 0);
    ground([140, 2.4], 0xcfc8b6, 20, 0);
    for (const x of [-18, -9, 0, 9, 18]) this.piece([4, 0.02, 0.3], 0xf4efe4, [x, 0.02, 14.3]);
    const homes: readonly [number, number, number, number][] = [
      [-24, 30, 0xbde0fe, 0x3f7fd6],
      [-8, 30, 0xffc8dd, 0xe8604c],
      [10, 30, 0xc8f2c2, 0x9b6bf2],
      [27, 30, 0xfff1a8, 0x3fae5a],
      [-26, -24, 0xffd6a5, 0xe8604c],
      [-2, -30, 0xbde0fe, 0x9b6bf2],
      [24, -24, 0xe3b8ff, 0x3f7fd6],
    ];
    for (const [x, z, wall, roof] of homes) {
      this.piece([9, 3.6, 7], wall, [x, 1.8, z]);
      const top = solid(new THREE.ConeGeometry(6.6, 2.8, 4), lowPoly(roof), [x, 5, z]);
      top.rotation.y = Math.PI / 4;
      top.scale.z = 0.8;
      this.group.add(top);
    }
    const trees: readonly [number, number, number][] = [
      [-14, -11, 1.5],
      [5, -11, 1.4],
      [13, -15, 1.8],
      [-19, -3, 1.7],
      [20, 1, 1.6],
      [-30, 8, 1.5],
      [33, 12, 1.7],
    ];
    for (const [x, z, size] of trees) {
      this.piece([0.36, size * 1.6, 0.36], 0x8a5a3b, [x, size * 0.8, z]);
      const crown = new THREE.IcosahedronGeometry(size, 1);
      this.group.add(solid(crown, lowPoly(0x4f9a56), [x, size * 2.2, z]));
    }
    this.addWindowSky();
  }

  private addWindowSky(): void {
    // The tree bends from its foot, so it stands alone.
    this.bentTree.position.set(-5, 0, -14);
    this.bentTree.add(
      solid(new THREE.BoxGeometry(0.4, 3, 0.4), lowPoly(0x8a5a3b), [0, 1.5, 0]),
      solid(new THREE.IcosahedronGeometry(1.9, 1), lowPoly(0x4f9a56), [0, 4.2, 0]),
    );
    this.skyDisc.position.set(-11, 7, -30);
    const puffs: readonly [number, number, number][] = [
      [-13, 7, 1.8],
      [-10.8, 7.6, 2.3],
      [-8.4, 7, 1.7],
      [-2.5, 8.4, 1.9],
      [0, 9, 2.4],
      [2.6, 8.4, 1.8],
      [-18, 9, 2.1],
    ];
    for (const [x, y, size] of puffs) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), this.cloudSurface);
      puff.position.set(x, y, -30);
      puff.scale.y = 0.62;
      this.clouds.add(puff);
    }
    this.group.add(this.bentTree, this.skyDisc, this.clouds);
  }

  private addGrounds(): void {
    const lawn = new THREE.Mesh(
      new THREE.CircleGeometry(70, 40).rotateX(-Math.PI / 2),
      lowPoly(0x8fd86e),
    );
    lawn.position.y = -0.02;
    lawn.receiveShadow = true;
    this.group.add(lawn);
    this.addNeighborhood();
    const rooms: readonly [number, number, number][] = [
      [-4, -3, 0xf6d9e6],
      [4, -3, 0xd6f0fb],
      [-4, 3, 0xf2dfc0],
      [4, 3, 0xfff1c8],
    ];
    for (const [x, z, color] of rooms) this.piece([8, 0.04, 6], color, [x, 0.02, z]);
  }

  /** A wall from one point to another, along x or along z. */
  private wall(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    height: number,
    color: number,
  ): void {
    const width = Math.abs(x2 - x1) + THICK;
    const depth = Math.abs(z2 - z1) + THICK;
    const x = (x1 + x2) / 2;
    const z = (z1 + z2) / 2;
    this.piece([width, height, depth], color, [x, height / 2, z]);
    this.block(x, z, width, depth);
  }

  private addWalls(): void {
    const outer = 0xf7efe0;
    const inner = 0xfdf6ea;
    const { left, right, bottom, top } = WINDOW_GAP;
    this.wall(-HALF_WIDTH, -HALF_DEPTH, left, -HALF_DEPTH, WALL, outer);
    this.wall(right, -HALF_DEPTH, HALF_WIDTH, -HALF_DEPTH, WALL, outer);
    const middle = (left + right) / 2;
    const gap = right - left;
    this.piece([gap, bottom, THICK], outer, [middle, bottom / 2, -HALF_DEPTH]);
    this.piece([gap, WALL - top, THICK], outer, [middle, (WALL + top) / 2, -HALF_DEPTH]);
    this.block(middle, -HALF_DEPTH, gap, THICK);
    this.wall(-HALF_WIDTH, -HALF_DEPTH, -HALF_WIDTH, HALF_DEPTH, WALL, outer);
    this.wall(HALF_WIDTH, -HALF_DEPTH, HALF_WIDTH, HALF_DEPTH, WALL, outer);
    // The front wall, with the street door.
    this.wall(-HALF_WIDTH, HALF_DEPTH, -5, HALF_DEPTH, LOW_WALL, outer);
    this.wall(-3, HALF_DEPTH, HALF_WIDTH, HALF_DEPTH, LOW_WALL, outer);
    this.block(-4, HALF_DEPTH, 2, THICK);
    this.piece([1.9, 2.2, 0.1], this.shining('door', 0xc4513c), [-4, 1.1, HALF_DEPTH]);
    this.piece([0.1, 0.1, 0.16], 0xffd23f, [-3.4, 1.05, HALF_DEPTH - 0.05]);
    // Between the back rooms and the front rooms.
    this.wall(-HALF_WIDTH, 0, -5, 0, ROOM_WALL, inner);
    this.wall(-3.2, 0, HALF_WIDTH, 0, ROOM_WALL, inner);
    // Between left and right, with two doorways.
    this.wall(0, -HALF_DEPTH, 0, -3.4, ROOM_WALL, inner);
    this.wall(0, -1.8, 0, 2, ROOM_WALL, inner);
    this.wall(0, 3.6, 0, HALF_DEPTH, ROOM_WALL, inner);
  }

  private addBedroom(): void {
    // The bed, with its head against the wall under the window.
    this.piece([1.8, 0.4, 2.8], 0xc98a4b, [-6.2, 0.2, -4.4]);
    this.piece([1.7, 0.16, 2.7], 0xffffff, [-6.2, 0.46, -4.4]);
    this.piece([1.72, 0.1, 1.7], this.shining('bed', 0x9b6bf2), [-6.2, 0.58, -3.9]);
    this.piece([1.1, 0.16, 0.5], 0xfff1d6, [-6.2, 0.6, -5.4]);
    this.block(-6.2, -4.4, 1.9, 2.9);
    this.windowPane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 1.1),
      new THREE.MeshBasicMaterial({
        color: 0xcfeaff,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      }),
    );
    this.windowPane.position.set(-6.2, 1.8, -5.86);
    this.group.add(this.windowPane);
    this.rainPane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 1.1),
      new THREE.MeshBasicMaterial({ map: this.drops, transparent: true, depthWrite: false }),
    );
    this.rainPane.position.set(-6.2, 1.8, -5.85);
    this.group.add(this.rainPane);
    this.piece([2.2, 0.08, 0.1], 0xffffff, [-6.2, 2.38, -5.86]);
    this.piece([2.2, 0.08, 0.1], 0xffffff, [-6.2, 1.22, -5.86]);
    this.piece([0.07, 1.1, 0.08], 0xffffff, [-6.2, 1.8, -5.86]);
    for (const x of [-7.23, -5.17]) this.piece([0.08, 1.2, 0.1], 0xffffff, [x, 1.8, -5.86]);
    // Wardrobe and a tall mirror.
    this.piece([2, 2.3, 0.8], this.shining('wardrobe', 0xf6c28b), [-2.2, 1.15, -5.45]);
    this.piece([0.03, 2.1, 0.03], 0x8a5a3b, [-2.2, 1.15, -5.04]);
    this.block(-2.2, -5.45, 2.1, 0.9);
    this.piece([1.25, 2.25, 0.05], 0x8a5a3b, [-3.8, 1.25, -5.88]);
    this.piece([1.1, 2.1, 0.03], 0xdfeeff, [-3.8, 1.25, -5.84]);
    // Desk with a chair, against the low wall.
    this.piece([2.2, 0.08, 0.8], this.shining('desk', 0xd08c4a), [-6.6, 0.8, -0.6]);
    for (const x of [-7.6, -5.6]) this.piece([0.1, 0.8, 0.7], 0xb9783f, [x, 0.4, -0.6]);
    this.block(-6.6, -0.6, 2.3, 0.9);
    this.piece([0.55, 0.08, 0.55], 0x7ec8a3, [-6.6, 0.42, -1.45]);
    this.piece([0.5, 0.42, 0.5], 0x5fa883, [-6.6, 0.2, -1.45]);
    // A round rug. The backpack waits beside it, when it is at home.
    const rug = solid(
      new THREE.CylinderGeometry(1, 1, 0.03, 24),
      lowPoly(0x7ec8a3),
      [-3, 0.05, -2.8],
    );
    this.group.add(rug);
  }

  private addBathroom(): void {
    // Sink with a mirror, a cup with the toothbrush and a towel.
    this.piece([1.4, 0.8, 0.7], this.shining('sink', 0x8fd3f4), [2.2, 0.4, -5.45]);
    this.group.add(
      solid(
        new THREE.CylinderGeometry(0.36, 0.28, 0.12, 14),
        lowPoly(0xffffff),
        [2.2, 0.86, -5.45],
      ),
    );
    this.piece([0.06, 0.22, 0.26], 0x9aa0b4, [2.2, 1.0, -5.65]);
    this.piece([1.3, 1.2, 0.05], 0xd6f3ff, [2.2, 1.6, -5.86]);
    this.piece([0.1, 0.22, 0.1], 0xffc93c, [2.75, 0.92, -5.5]);
    this.piece([0.05, 0.3, 0.05], 0x3fa9f5, [2.75, 1.1, -5.5]);
    this.block(2.2, -5.45, 1.5, 0.8);
    this.piece([0.7, 0.9, 0.05], 0xff7a6b, [0.9, 1.5, -5.86]);
    // Toilet.
    this.group.add(
      solid(new THREE.CylinderGeometry(0.34, 0.28, 0.45, 14), lowPoly(0xffffff), [4.2, 0.22, -5.1]),
    );
    this.piece([0.75, 0.7, 0.28], 0xffffff, [4.2, 0.5, -5.72]);
    this.block(4.2, -5.3, 0.85, 1.2);
    // Shower: a tray, a pipe and an opaque curtain.
    this.piece([2.6, 0.08, 2.8], this.shining('shower', 0xd9dde6), [6.6, 0.06, -4.5]);
    this.group.add(
      solid(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 8), lowPoly(0x9aa0b4), [6.6, 1.2, -5.85]),
    );
    this.piece([0.5, 0.06, 0.5], 0x9aa0b4, [6.6, 2.3, -5.5]);
    this.piece([2.7, 0.05, 0.05], 0x9aa0b4, [6.6, 2.4, -3.1]);
    this.piece([0.2, 2.4, 0.1], 0xfdf6ea, [5.25, 1.2, -3.1]);
  }

  /** What the child bought for the room. */
  showDecor(items: readonly { readonly id: string; readonly icon: string }[]): void {
    this.decor.clear();
    const spots: Readonly<Record<string, readonly [number, number, number]>> = {
      poster: [-4.6, 1.7, -5.8],
      plant: [-0.9, 0.05, -5.2],
      pillow: [-5.9, 0.75, -5.2],
      stars: [-1.2, 2, -5.8],
    };
    for (const { id, icon } of items) {
      const [x = 0, y = 0, z = 0] = spots[id] ?? [];
      const item = pictureOf({ pictogram: icon });
      item.scale.setScalar(2);
      item.position.set(x, y, z);
      this.decor.add(item);
    }
  }

  /** A soft light in the corner, and nothing else changes. */
  setCalmLight(on: boolean): void {
    this.calmGlow.visible = on;
  }

  private addLivingRoom(): void {
    // The calm corner: a cushion, a bear and a lamp, on the round rug.
    this.piece([1, 0.12, 1], this.shining('calm', 0xb9a7e8), [-3.6, 0.1, 3.4]);
    const bear = pictureOf({ pictogram: '🧸' });
    bear.position.set(-2.8, 0.05, 3.7);
    this.group.add(bear);
    this.calmGlow.position.set(-3.6, 1.6, 3.4);
    this.calmGlow.visible = false;
    this.group.add(this.calmGlow);
    this.piece([1, 0.45, 2.6], 0x5b8fd6, [-7.2, 0.25, 3]);
    this.piece([0.3, 0.9, 2.6], 0x4a7fc4, [-7.6, 0.5, 3]);
    this.block(-7.2, 3, 1.2, 2.7);
    this.group.add(
      solid(new THREE.CylinderGeometry(1.4, 1.4, 0.03, 24), lowPoly(0xe9b872), [-3.6, 0.05, 2.8]),
    );
    this.piece([1.2, 0.35, 0.7], 0xb9783f, [-3.4, 0.2, 1.4]);
    this.block(-3.4, 1.4, 1.3, 0.8);
  }

  private addKitchen(): void {
    // Counter, stove and fridge along the low wall.
    this.piece([3.6, 0.9, 0.7], 0xffffff, [4.2, 0.45, 0.5]);
    this.piece([3.7, 0.06, 0.8], 0xd9c6a3, [4.2, 0.92, 0.5]);
    for (const x of [3.3, 3.9]) {
      this.group.add(
        solid(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 12), this.shining('stove', 0x2d3142), [
          x,
          0.97,
          0.5,
        ]),
      );
    }
    this.group.add(
      solid(new THREE.CylinderGeometry(0.2, 0.18, 0.28, 14), lowPoly(0xe8433b), [3.3, 1.12, 0.5]),
    );
    this.block(4.2, 0.5, 3.7, 0.85);
    this.piece([1.1, 2.1, 0.8], 0xdfe7ee, [7.3, 1.05, 0.6]);
    this.block(7.3, 0.6, 1.2, 0.9);
    // The door turns on its hinge, and shows what there is inside.
    const door = solid(
      new THREE.BoxGeometry(1.1, 2.1, 0.06),
      this.shining('fridge', 0xf0f4f8),
      [-0.55, 1.05, 0],
    );
    this.fridgeDoor.add(door);
    this.fridgeDoor.position.set(7.85, 0, 1.02);
    this.group.add(this.fridgeDoor);
    // A second chair at the table, for the adult.
    this.piece([0.55, 0.42, 0.55], 0x5fa883, [2.85, 0.21, 2.75]);
    // Table for the family; the child sits facing the camera.
    this.piece([2.2, 0.08, 1.3], this.shining('table', 0xd08c4a), [3.8, 0.74, 3.7]);
    for (const [dx, dz] of [
      [-1, -0.55],
      [1, -0.55],
      [-1, 0.55],
      [1, 0.55],
    ] as const) {
      this.piece([0.1, 0.7, 0.1], 0xb9783f, [3.8 + dx, 0.35, 3.7 + dz]);
    }
    this.block(3.8, 3.7, 2.3, 1.4);
    this.piece([0.5, 0.42, 0.5], 0xff7a6b, [3.8, 0.21, 2.75]);
  }
}
