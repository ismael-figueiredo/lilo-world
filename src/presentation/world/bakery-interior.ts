import * as THREE from 'three';
import { box, circle, type Collider } from '@presentation/world/collision';
import type { WalkableSpace } from '@presentation/world/game-world';
import type { Interactable } from '@presentation/world/interactable';
import { BAKERY_INTERIOR, BakeryPlace } from '@presentation/world/market-position';
import { lowPoly, solid } from '@presentation/world/materials';
import { mergeStatic } from '@presentation/world/merge-static';
import { createSign } from '@presentation/world/sign';
import type { Zone } from '@presentation/world/zones/zone';

const FLOOR = -5;
const ROOM = { width: 13, depth: 10, height: 3.2 } as const;
const COUNTER = { z: -1.7, width: 7.6, depth: 1.1, height: 1 } as const;
const SHELF_Z = -4.5;
const TILE = 1.6;

/** The same kind of room as the market: open to the camera, with one counter to walk to. */
export class BakeryInterior implements Zone, WalkableSpace {
  readonly group = new THREE.Group();
  readonly colliders: readonly Collider[] = [];
  readonly places: readonly Interactable[] = [];
  readonly height = FLOOR;
  readonly walkColliders: Collider[] = [];
  readonly walkPlaces: Interactable[] = [];

  constructor() {
    this.group.position.set(BAKERY_INTERIOR.x, FLOOR, BAKERY_INTERIOR.z);
    this.addRoom();
    this.addShelves();
    this.addCounter();
    this.addOven();
    this.addTables();
    this.addPlaces();
    mergeStatic(this.group);
  }

  private world(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(BAKERY_INTERIOR.x + x, FLOOR, BAKERY_INTERIOR.z + z);
  }

  private block(x: number, z: number, width: number, depth: number): void {
    this.walkColliders.push(box(BAKERY_INTERIOR.x + x, BAKERY_INTERIOR.z + z, width, depth));
  }

  private addRoom(): void {
    const { width, depth, height } = ROOM;
    // Beyond the open side there is the street floor, never the empty sky.
    this.group.add(
      solid(
        new THREE.CircleGeometry(60, 24).rotateX(-Math.PI / 2),
        lowPoly(0xe2d6bc),
        [0, -0.02, 0],
      ),
    );
    const light = lowPoly(0xfdf1dc);
    const warm = lowPoly(0xf2d9b0);
    for (let x = 0; x * TILE < width; x += 1) {
      for (let z = 0; z * TILE < depth; z += 1) {
        this.group.add(
          solid(new THREE.BoxGeometry(TILE, 0.04, TILE), (x + z) % 2 === 0 ? light : warm, [
            -width / 2 + (x + 0.5) * TILE,
            0.02,
            -depth / 2 + (z + 0.5) * TILE,
          ]),
        );
      }
    }
    const wall = lowPoly(0xf6c98a);
    this.group.add(
      solid(new THREE.BoxGeometry(width + 0.4, height, 0.2), wall, [0, height / 2, -depth / 2]),
      solid(new THREE.BoxGeometry(0.2, height, depth), wall, [-width / 2, height / 2, 0]),
      solid(new THREE.BoxGeometry(0.2, height, depth), wall, [width / 2, height / 2, 0]),
      solid(new THREE.BoxGeometry(width + 0.4, 0.5, 0.24), lowPoly(0xa0643c), [
        0,
        0.25,
        -depth / 2 + 0.02,
      ]),
    );
    this.block(0, -depth / 2 - 0.1, width, 0.4);
    this.block(-width / 2, 0, 0.4, depth);
    this.block(width / 2, 0, 0.4, depth);
    const sign = createSign(['🍞 PADARIA'], {
      background: '#a0643c',
      color: '#ffffff',
      width: 3.4,
      height: 0.7,
    });
    sign.position.set(0, 2.6, -depth / 2 + 0.14);
    this.group.add(sign);
  }

  /** A loaf, a roll or a round bread, lying down. */
  private bread(x: number, y: number, z: number, long: number, color: number): void {
    const loaf = solid(new THREE.IcosahedronGeometry(0.17, 1), lowPoly(color), [x, y, z]);
    loaf.scale.set(long, 0.7, 0.9);
    this.group.add(loaf);
  }

  private addShelves(): void {
    const wood = lowPoly(0xc98a4b);
    const breads = [0xd9a05b, 0xc4813f, 0xe6bd7a];
    for (const y of [0.9, 1.5, 2.1]) {
      this.group.add(solid(new THREE.BoxGeometry(9, 0.08, 0.7), wood, [0, y, SHELF_Z]));
      for (let index = 0; index < 11; index += 1) {
        const color = breads[index % breads.length] ?? 0xd9a05b;
        this.bread(-3.9 + index * 0.78, y + 0.14, SHELF_Z, index % 2 === 0 ? 1.9 : 1, color);
      }
    }
    for (const x of [-4.6, 4.6]) {
      this.group.add(solid(new THREE.BoxGeometry(0.12, 2.3, 0.7), wood, [x, 1.15, SHELF_Z]));
    }
    this.block(0, SHELF_Z, 9.4, 0.9);
  }

  private addCounter(): void {
    const { z, width, depth, height } = COUNTER;
    this.group.add(
      solid(new THREE.BoxGeometry(width, height, depth), lowPoly(0xa0643c), [0, height / 2, z]),
      solid(new THREE.BoxGeometry(width + 0.2, 0.08, depth + 0.2), lowPoly(0xf7efe0), [
        0,
        height + 0.02,
        z,
      ]),
    );
    // The glass case with cakes and cookies, on the left of the cash register.
    this.group.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(3, 0.6, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xcdeeff, transparent: true, opacity: 0.35 }),
      ),
    );
    const glass = this.group.children.at(-1);
    glass?.position.set(-1.8, height + 0.36, z);
    for (const [x, color] of [
      [-2.8, 0xf6c9d6],
      [-1.8, 0x7a4f30],
      [-0.8, 0xffe27a],
    ] as const) {
      this.group.add(
        solid(new THREE.CylinderGeometry(0.28, 0.3, 0.26, 12), lowPoly(color), [
          x,
          height + 0.2,
          z,
        ]),
      );
    }
    this.group.add(
      solid(new THREE.BoxGeometry(0.6, 0.35, 0.6), lowPoly(0x2d3142), [2.2, height + 0.22, z]),
      solid(
        new THREE.BoxGeometry(0.5, 0.3, 0.05),
        lowPoly(0x9fe0ff, { emissive: 0x9fe0ff, emissiveIntensity: 0.6 }),
        [2.2, height + 0.52, z + 0.2],
      ),
    );
    this.block(0, z, width + 0.3, depth + 0.3);
  }

  private addOven(): void {
    const brick = lowPoly(0xb0553f);
    this.group.add(
      solid(new THREE.BoxGeometry(2.2, 2.2, 1.6), brick, [5.2, 1.1, -3.8]),
      solid(new THREE.BoxGeometry(1.1, 0.8, 0.1), lowPoly(0x2d3142), [5.2, 1.2, -2.98]),
      solid(
        new THREE.BoxGeometry(0.9, 0.5, 0.06),
        lowPoly(0xffa53d, { emissive: 0xff7a00, emissiveIntensity: 0.7 }),
        [5.2, 1.2, -2.92],
      ),
    );
    this.block(5.2, -3.8, 2.3, 1.7);
  }

  private addTables(): void {
    const wood = lowPoly(0xc98a4b);
    for (const x of [-4.2, 4.2]) {
      this.group.add(
        solid(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 16), wood, [x, 0.74, 1.6]),
        solid(new THREE.CylinderGeometry(0.08, 0.1, 0.72, 8), wood, [x, 0.36, 1.6]),
      );
      this.walkColliders.push(circle(BAKERY_INTERIOR.x + x, BAKERY_INTERIOR.z + 1.6, 0.85));
      for (const side of [-1.2, 1.2]) {
        this.group.add(
          solid(new THREE.CylinderGeometry(0.28, 0.28, 0.46, 10), lowPoly(0xe8604c), [
            x + side,
            0.23,
            1.6,
          ]),
        );
        this.walkColliders.push(
          circle(BAKERY_INTERIOR.x + x + side, BAKERY_INTERIOR.z + 1.6, 0.34),
        );
      }
    }
  }

  private addPlaces(): void {
    const place = (id: string, z: number, icon: string, label: string, name: string): void => {
      const position = this.world(0, z);
      this.walkPlaces.push({
        id,
        position,
        markerPosition: position.clone().setY(FLOOR + 3),
        radius: 1.7,
        icon,
        label,
        name,
      });
    };
    place(BakeryPlace.counter, COUNTER.z + 1.5, '🥖', 'Pedir no balcão', 'Balcão');
    place(BakeryPlace.door, ROOM.depth / 2 - 0.9, '🚪', 'Sair', 'Porta');
  }

  /** Behind the counter, facing the shop. */
  get bakerSpot(): THREE.Vector3 {
    return this.world(0, COUNTER.z - 1.1);
  }

  /** In front of the counter, from where the camera sees both. */
  get orderCamera(): { readonly position: THREE.Vector3; readonly lookAt: THREE.Vector3 } {
    return {
      position: this.world(1.8, 2.6).setY(FLOOR + 2.3),
      lookAt: this.world(-0.4, COUNTER.z - 0.4).setY(FLOOR + 1.1),
    };
  }

  get entrance(): THREE.Vector3 {
    return this.world(0, ROOM.depth / 2 - 1.2);
  }

  contains(x: number, z: number): boolean {
    return (
      Math.abs(x - BAKERY_INTERIOR.x) < ROOM.width / 2 &&
      Math.abs(z - BAKERY_INTERIOR.z) < ROOM.depth / 2
    );
  }
}
