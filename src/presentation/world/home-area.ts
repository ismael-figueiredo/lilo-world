import * as THREE from 'three';
import { box, circle, type Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import { lowPoly, solid } from '@presentation/world/materials';
import { createPostSign, createSign } from '@presentation/world/sign';
import { fitHeight, type WorldAssets } from '@presentation/world/world-assets';

/** The routines house: a big dollhouse open at the front, east of the new neighborhood. */
export const HOME_AREA = { x: 64, z: 44, radius: 14, height: 2.2 } as const;

export const HomePlace = {
  bathroom: 'home:bathroom',
  bedroom: 'home:bedroom',
  kitchen: 'home:kitchen',
  back: 'home:back',
} as const;

/** Where the child appears when coming through the Casa portal (looking at the house). */
export const homeArrival = new THREE.Vector3(HOME_AREA.x, HOME_AREA.height, HOME_AREA.z + 6);

const ROOM = { width: 7, depth: 5.5, height: 3 } as const;
/** Rooms stand in a row on the north side; their places are in front (south). */
const ROW_Z = -5;
const PLACE_Z = ROW_Z + ROOM.depth / 2 + 2;

/** Three open rooms in a row (bathroom, bedroom, kitchen), a little yard and the way back. */
export class HomeArea {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly places: Interactable[] = [];

  constructor(private readonly assets: WorldAssets) {
    this.group.position.set(HOME_AREA.x, HOME_AREA.height, HOME_AREA.z);
    const rooms: readonly [number, number, number, string][] = [
      [-ROOM.width, 0xbfe9ff, 0xe0f4ff, '🛁 BANHEIRO'],
      [0, 0xffd6e7, 0xfff0f5, '🛏️ QUARTO'],
      [ROOM.width, 0xfff1b8, 0xfffae0, '🍳 COZINHA'],
    ];
    for (const [x, wall, floor, title] of rooms) this.addRoom(x, wall, floor, title);
    this.addBathroom(-ROOM.width);
    this.addBedroom(0);
    this.addKitchen(ROOM.width);
    this.addYard();
  }

  private at(x: number, z: number): { x: number; z: number } {
    return { x: HOME_AREA.x + x, z: HOME_AREA.z + z };
  }

  private addPlace(id: string, x: number, icon: string, label: string, name: string): void {
    const spot = this.at(x, PLACE_Z);
    this.places.push({
      id,
      position: new THREE.Vector3(spot.x, HOME_AREA.height, spot.z),
      markerPosition: new THREE.Vector3(spot.x, HOME_AREA.height + ROOM.height + 1.2, spot.z - 2),
      radius: 3.2,
      icon,
      label,
      name,
      // The rooms are open to the south.
      viewFrom: 'south',
    });
  }

  /** Floor, back wall and side walls; the front stays open like a dollhouse. */
  private addRoom(x: number, wall: number, floor: number, title: string): void {
    const walls = lowPoly(wall);
    const { width, depth, height } = ROOM;
    this.group.add(
      solid(new THREE.BoxGeometry(width, 0.2, depth), lowPoly(floor), [x, 0.1, ROW_Z]),
    );
    this.group.add(
      solid(new THREE.BoxGeometry(width, height, 0.25), walls, [x, height / 2, ROW_Z - depth / 2]),
    );
    for (const side of [-1, 1]) {
      this.group.add(
        solid(new THREE.BoxGeometry(0.25, height, depth), walls, [
          x + (side * width) / 2,
          height / 2,
          ROW_Z,
        ]),
      );
    }
    const sign = createSign([title], {
      background: '#e8604c',
      color: '#ffffff',
      width: 3.4,
      height: 0.8,
    });
    sign.position.set(x, height + 0.55, ROW_Z - depth / 2 + 0.2);
    this.group.add(sign);
    const spot = this.at(x, ROW_Z);
    // Walls block walking; the camera may look in from the open front.
    this.colliders.push(box(spot.x, spot.z, width + 0.3, depth + 0.3));
  }

  private addBathroom(x: number): void {
    const white = lowPoly(0xffffff);
    const back = ROW_Z - ROOM.depth / 2 + 0.6;
    // Sink with mirror, a cup with the toothbrush, and a towel.
    this.group.add(
      solid(new THREE.BoxGeometry(1.4, 0.9, 0.8), lowPoly(0x8fd3f4), [x - 1.8, 0.65, back]),
    );
    this.group.add(
      solid(new THREE.CylinderGeometry(0.4, 0.3, 0.2, 14), white, [x - 1.8, 1.18, back]),
    );
    this.group.add(
      solid(
        new THREE.BoxGeometry(1.1, 0.9, 0.06),
        lowPoly(0xd6f3ff, { emissive: 0xbfe9ff, emissiveIntensity: 0.35, roughness: 0.1 }),
        [x - 1.8, 2, back - 0.35],
      ),
    );
    this.group.add(
      solid(new THREE.CylinderGeometry(0.1, 0.08, 0.25, 10), lowPoly(0xffc93c), [
        x - 1.3,
        1.25,
        back,
      ]),
    );
    this.group.add(
      solid(new THREE.BoxGeometry(0.05, 0.4, 0.05), lowPoly(0x3fa9f5), [x - 1.3, 1.45, back]),
    );
    this.group.add(
      solid(new THREE.BoxGeometry(0.7, 0.9, 0.06), lowPoly(0xff7a6b), [x + 0.2, 1.6, back - 0.4]),
    );
    // Toilet.
    this.group.add(
      solid(new THREE.CylinderGeometry(0.35, 0.3, 0.5, 14), white, [x + 0.3, 0.45, back + 0.6]),
    );
    this.group.add(solid(new THREE.BoxGeometry(0.8, 0.7, 0.3), white, [x + 0.3, 0.75, back - 0.1]));
    // Shower: tray, pipe and head.
    this.group.add(
      solid(new THREE.BoxGeometry(1.5, 0.12, 1.5), lowPoly(0xd9dde6), [x + 2.4, 0.26, back + 0.4]),
    );
    this.group.add(
      solid(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), lowPoly(0x9aa0b4), [
        x + 2.9,
        1.3,
        back - 0.2,
      ]),
    );
    const head = solid(new THREE.CylinderGeometry(0.22, 0.12, 0.12, 12), lowPoly(0x9aa0b4), [
      x + 2.6,
      2.35,
      back + 0.1,
    ]);
    head.rotation.x = 0.4;
    this.group.add(head);
    this.addPlace(HomePlace.bathroom, x, '🪥', 'Banheiro', 'Banheiro');
  }

  private addBedroom(x: number): void {
    const back = ROW_Z - ROOM.depth / 2 + 0.25;
    // Bed with a pillow and a blanket.
    this.group.add(
      solid(new THREE.BoxGeometry(1.8, 0.45, 2.8), lowPoly(0xc98a4b), [x - 1.8, 0.42, back + 1.5]),
    );
    this.group.add(
      solid(new THREE.BoxGeometry(1.7, 0.2, 2.7), lowPoly(0xffffff), [x - 1.8, 0.75, back + 1.5]),
    );
    this.group.add(
      solid(new THREE.BoxGeometry(1.72, 0.1, 1.8), lowPoly(0x9b6bf2), [x - 1.8, 0.88, back + 1.95]),
    );
    this.group.add(
      solid(new THREE.BoxGeometry(1.2, 0.25, 0.5), lowPoly(0xfff1d6), [x - 1.8, 0.95, back + 0.4]),
    );
    this.group.add(
      solid(new THREE.BoxGeometry(1.8, 0.9, 0.2), lowPoly(0xc98a4b), [x - 1.8, 0.65, back + 0.1]),
    );
    // Wardrobe with two doors and knobs.
    this.group.add(
      solid(new THREE.BoxGeometry(1.8, 2.3, 0.8), lowPoly(0xf6c28b), [x + 1.9, 1.35, back + 0.4]),
    );
    for (const dx of [-0.12, 0.12]) {
      this.group.add(
        solid(new THREE.SphereGeometry(0.06, 8, 6), lowPoly(0x8a5a3b), [
          x + 1.9 + dx,
          1.4,
          back + 0.82,
        ]),
      );
    }
    // A round rug.
    this.group.add(
      solid(new THREE.CylinderGeometry(1, 1, 0.04, 24), lowPoly(0x7ec8a3), [
        x + 0.4,
        0.22,
        ROW_Z + 0.9,
      ]),
    );
    this.addPlace(HomePlace.bedroom, x, '👕', 'Quarto', 'Quarto');
  }

  private addKitchen(x: number): void {
    const back = ROW_Z - ROOM.depth / 2 + 0.5;
    // Fridge and stove against the wall.
    this.group.add(
      solid(new THREE.BoxGeometry(1.1, 2.2, 0.9), lowPoly(0xf0f4f8), [x + 2.5, 1.3, back + 0.1]),
    );
    this.group.add(
      solid(new THREE.BoxGeometry(0.06, 0.6, 0.06), lowPoly(0x9aa0b4), [
        x + 2.05,
        1.5,
        back + 0.58,
      ]),
    );
    this.group.add(
      solid(new THREE.BoxGeometry(1.2, 0.9, 0.8), lowPoly(0xffffff), [x + 1.1, 0.65, back + 0.05]),
    );
    for (const dx of [-0.3, 0.3]) {
      this.group.add(
        solid(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12), lowPoly(0x2d3142), [
          x + 1.1 + dx,
          1.12,
          back,
        ]),
      );
    }
    this.group.add(
      solid(new THREE.CylinderGeometry(0.22, 0.2, 0.3, 14), lowPoly(0xe8433b), [
        x + 0.8,
        1.3,
        back,
      ]),
    );
    // Table with four chairs.
    const wood = lowPoly(0xd08c4a);
    this.group.add(solid(new THREE.BoxGeometry(2, 0.12, 1.3), wood, [x - 1.2, 1, ROW_Z + 0.4]));
    for (const [dx, dz] of [
      [-0.85, -0.5],
      [0.85, -0.5],
      [-0.85, 0.5],
      [0.85, 0.5],
    ] as const) {
      this.group.add(
        solid(new THREE.BoxGeometry(0.1, 0.9, 0.1), wood, [x - 1.2 + dx, 0.5, ROW_Z + 0.4 + dz]),
      );
    }
    for (const dx of [-0.6, 0.6]) {
      for (const side of [-1, 1]) {
        this.group.add(
          solid(new THREE.BoxGeometry(0.5, 0.08, 0.5), lowPoly(0xff7a6b), [
            x - 1.2 + dx,
            0.6,
            ROW_Z + 0.4 + side,
          ]),
        );
      }
    }
    this.addPlace(HomePlace.kitchen, x, '🍽️', 'Cozinha', 'Cozinha');
  }

  private addYard(): void {
    this.group.add(
      solid(new THREE.BoxGeometry(ROOM.width * 3 + 2, 0.06, 3), lowPoly(0xe3ddd0), [
        0,
        0.03,
        PLACE_Z,
      ]),
    );
    for (const x of [-11.5, 11.5]) {
      const flowers = this.assets.clone(x < 0 ? 'bush-flowers' : 'flower-group');
      fitHeight(flowers, 1);
      flowers.position.set(x, 0, ROW_Z + 1);
      this.group.add(flowers);
    }
    const sign = createPostSign(
      ['🏡 CASA'],
      { background: '#f2a65a', color: '#ffffff', width: 2.6, height: 0.95 },
      1.4,
    );
    sign.position.set(-3, 0, PLACE_Z + 3.5);
    this.group.add(sign);
    const signSpot = this.at(-3, PLACE_Z + 3.5);
    this.colliders.push(circle(signSpot.x, signSpot.z, 0.5));

    const arch = new THREE.Group();
    const frame = lowPoly(0xf2a65a, { emissive: 0xf2a65a, emissiveIntensity: 0.3 });
    for (const dx of [-1.4, 1.4])
      arch.add(solid(new THREE.BoxGeometry(0.5, 2.4, 0.5), frame, [dx, 1.2, 0]));
    arch.add(solid(new THREE.TorusGeometry(1.4, 0.28, 8, 16, Math.PI), frame, [0, 2.4, 0]));
    arch.position.set(9, 0, PLACE_Z + 5);
    this.group.add(arch);
    for (const dx of [-1.4, 1.4]) {
      const spot = this.at(9 + dx, PLACE_Z + 5);
      this.colliders.push(circle(spot.x, spot.z, 0.4));
    }
    const spot = this.at(9, PLACE_Z + 3.6);
    this.places.push({
      id: HomePlace.back,
      position: new THREE.Vector3(spot.x, HOME_AREA.height, spot.z),
      markerPosition: new THREE.Vector3(spot.x, HOME_AREA.height + 4, spot.z),
      radius: 2.6,
      icon: '🌀',
      label: 'Voltar aos portais',
      name: 'Portal de volta',
    });
  }
}
