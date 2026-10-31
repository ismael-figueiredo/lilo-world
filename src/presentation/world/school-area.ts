import * as THREE from 'three';
import { box, circle, type Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import { lowPoly, solid } from '@presentation/world/materials';
import { slide, swings } from '@presentation/world/props';
import { createPostSign, createSign } from '@presentation/world/sign';
import { fitHeight, type WorldAssets } from '@presentation/world/world-assets';
import { SCHOOL_AREA, SchoolPlace } from '@presentation/world/zones/anchors';
import type { Zone } from '@presentation/world/zones/zone';

/** The classroom, open to the south like a dollhouse (local coordinates). */
const CLASS = { x: -5, z: -6, width: 13, depth: 7, height: 3.2 } as const;
const PARK = { x: 8.5, z: -4 } as const;

/** Classroom with desks and a blackboard, the teacher's desk, a park and the way back. */
export class SchoolArea implements Zone {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly places: Interactable[] = [];

  constructor(private readonly assets: WorldAssets) {
    this.group.position.set(SCHOOL_AREA.x, SCHOOL_AREA.height, SCHOOL_AREA.z);
    this.addClassroom();
    this.addPark();
    this.addYard();
  }

  private at(x: number, z: number): { x: number; z: number } {
    return { x: SCHOOL_AREA.x + x, z: SCHOOL_AREA.z + z };
  }

  private block(x: number, z: number, width: number, depth: number): void {
    const spot = this.at(x, z);
    this.colliders.push(box(spot.x, spot.z, width, depth));
  }

  private addPlace(
    id: string,
    x: number,
    z: number,
    icon: string,
    label: string,
    name: string,
  ): void {
    const spot = this.at(x, z);
    this.places.push({
      id,
      position: new THREE.Vector3(spot.x, SCHOOL_AREA.height, spot.z),
      markerPosition: new THREE.Vector3(spot.x, SCHOOL_AREA.height + 3.6, spot.z - 1),
      radius: 2.6,
      icon,
      label,
      name,
      viewFrom: 'south',
    });
  }

  private addClassroom(): void {
    const { x, z, width, depth, height } = CLASS;
    const wall = lowPoly(0xd6ecff);
    const back = z - depth / 2;
    this.group.add(solid(new THREE.BoxGeometry(width, 0.2, depth), lowPoly(0xe9d3b0), [x, 0.1, z]));
    this.group.add(solid(new THREE.BoxGeometry(width, height, 0.3), wall, [x, height / 2, back]));
    this.block(x, back, width, 0.5);
    for (const side of [-1, 1]) {
      const sx = x + (side * width) / 2;
      this.group.add(solid(new THREE.BoxGeometry(0.3, height, depth), wall, [sx, height / 2, z]));
      this.block(sx, z, 0.5, depth);
    }
    // A low roof edge and the school's name.
    this.group.add(
      solid(new THREE.BoxGeometry(width + 0.6, 0.35, 0.8), lowPoly(0xe8604c), [
        x,
        height + 0.15,
        back + 0.2,
      ]),
    );
    const name = createSign(['🏫 ESCOLA'], {
      background: '#b08ee6',
      color: '#ffffff',
      width: 3.6,
      height: 0.9,
    });
    name.position.set(x, height + 1.05, back + 0.75);
    this.group.add(name);

    // Blackboard with letters and numbers, and a bookshelf.
    const board = createSign(['A B C  1 2 3'], {
      background: '#2f5d50',
      color: '#ffffff',
      width: 4.4,
      height: 1.5,
    });
    board.position.set(x - 1, 1.9, back + 0.2);
    this.group.add(board);
    const shelfWood = lowPoly(0xc98a4b);
    const shelfX = x + 4.8;
    this.group.add(solid(new THREE.BoxGeometry(1.8, 2, 0.6), shelfWood, [shelfX, 1.1, back + 0.5]));
    const bookColors = [0xe8433b, 0x3fa9f5, 0xffc93c, 0x3fae5a, 0x9b6bf2];
    for (let shelf = 0; shelf < 2; shelf += 1) {
      bookColors.forEach((color, index) => {
        this.group.add(
          solid(new THREE.BoxGeometry(0.22, 0.5, 0.4), lowPoly(color), [
            shelfX - 0.6 + index * 0.3,
            0.6 + shelf * 0.8,
            back + 0.75,
          ]),
        );
      });
    }
    this.block(shelfX, back + 0.5, 2, 0.8);

    // Children's desks: two rows of three, each with a chair.
    const desk = lowPoly(0xf6c28b);
    const chair = lowPoly(0x3fa9f5);
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const dx = x - 3 + col * 2.6;
        const dz = z + 0.2 + row * 1.9;
        this.group.add(solid(new THREE.BoxGeometry(1.2, 0.08, 0.7), desk, [dx, 0.85, dz]));
        for (const [lx, lz] of [
          [-0.5, -0.28],
          [0.5, -0.28],
          [-0.5, 0.28],
          [0.5, 0.28],
        ] as const) {
          this.group.add(
            solid(new THREE.BoxGeometry(0.07, 0.7, 0.07), desk, [dx + lx, 0.45, dz + lz]),
          );
        }
        this.group.add(solid(new THREE.BoxGeometry(0.55, 0.07, 0.5), chair, [dx, 0.55, dz + 0.65]));
        this.group.add(solid(new THREE.BoxGeometry(0.55, 0.5, 0.07), chair, [dx, 0.8, dz + 0.9]));
        this.block(dx, dz + 0.3, 1.3, 1.4);
      }
    }
    // A backpack waiting on the first desk.
    this.group.add(
      solid(new THREE.BoxGeometry(0.5, 0.6, 0.3), lowPoly(0x3fae5a), [x - 3, 1.2, z + 0.2]),
    );
    this.addPlace(SchoolPlace.classroom, x - 3, z + 4.6, '🎒', 'Arrumar a mochila', 'Sala de aula');

    // The teacher's desk by the blackboard, with an apple.
    const teacherX = x - 5;
    const teacherZ = back + 1.6;
    this.group.add(
      solid(new THREE.BoxGeometry(1.8, 0.9, 0.9), lowPoly(0xa86b3c), [teacherX, 0.55, teacherZ]),
    );
    this.group.add(
      solid(new THREE.SphereGeometry(0.14, 10, 8), lowPoly(0xe8433b), [
        teacherX + 0.5,
        1.12,
        teacherZ,
      ]),
    );
    this.block(teacherX, teacherZ, 2, 1.1);
    const teacherSign = createSign(['👩‍🏫 PROFESSORA'], {
      background: '#e8604c',
      color: '#ffffff',
      width: 2.4,
      height: 0.6,
    });
    teacherSign.position.set(teacherX, 1.35, teacherZ + 0.47);
    this.group.add(teacherSign);
    this.addPlace(
      SchoolPlace.teacher,
      teacherX + 0.2,
      teacherZ + 1.8,
      '👋',
      'Falar com a professora',
      'Professora',
    );
  }

  private addPark(): void {
    const { x, z } = PARK;
    this.group.add(solid(new THREE.BoxGeometry(10, 0.08, 9), lowPoly(0x7ec8a3), [x, 0.04, z]));
    const slideSet = slide();
    slideSet.position.set(x - 2.5, 0, z - 1.5);
    this.group.add(slideSet);
    this.block(x - 2.5, z - 1.8, 1.6, 3.6);
    const swingSet = swings();
    swingSet.position.set(x + 2.6, 0, z - 1.8);
    swingSet.rotation.y = Math.PI / 2;
    this.group.add(swingSet);
    this.block(x + 2.6, z - 1.8, 1.2, 4);
    // Sandbox with a bucket.
    const sandX = x + 1;
    const sandZ = z + 2.8;
    this.group.add(
      solid(new THREE.BoxGeometry(2.6, 0.3, 2), lowPoly(0xc98a4b), [sandX, 0.15, sandZ]),
    );
    this.group.add(
      solid(new THREE.BoxGeometry(2.3, 0.32, 1.7), lowPoly(0xf4dfa0), [sandX, 0.17, sandZ]),
    );
    this.group.add(
      solid(new THREE.CylinderGeometry(0.18, 0.13, 0.3, 10), lowPoly(0xe8433b), [
        sandX + 0.6,
        0.48,
        sandZ,
      ]),
    );
    this.block(sandX, sandZ, 2.7, 2.1);
    const sign = createPostSign(
      ['🛝 PARQUE'],
      { background: '#3fae5a', color: '#ffffff', width: 2.6, height: 0.9 },
      1.4,
    );
    sign.position.set(x - 4.6, 0, z + 3.6);
    this.group.add(sign);
    const spot = this.at(x - 4.6, z + 3.6);
    this.colliders.push(circle(spot.x, spot.z, 0.5));
    this.addPlace(SchoolPlace.park, x - 2.5, z + 1.6, '🛝', 'Brincar no parque', 'Parque');
  }

  private addYard(): void {
    for (const [x, z] of [
      [-16, -4],
      [15, 5],
    ] as const) {
      const tree = this.assets.clone('tree-round');
      fitHeight(tree, 5);
      tree.position.set(x, 0, z);
      this.group.add(tree);
      const spot = this.at(x, z);
      this.colliders.push(circle(spot.x, spot.z, 0.45));
    }
  }
}
