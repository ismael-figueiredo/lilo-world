import * as THREE from 'three';
import { box, type Collider } from '@presentation/world/collision';
import type { WalkableSpace } from '@presentation/world/game-world';
import type { Interactable } from '@presentation/world/interactable';
import { SCHOOL_BUILDING } from '@presentation/world/market-position';
import { lowPoly, solid } from '@presentation/world/materials';
import { mergeStatic } from '@presentation/world/merge-static';
import { createSign } from '@presentation/world/sign';
import { StudyDesk } from '@presentation/world/study-desk';
import type { Zone } from '@presentation/world/zones/zone';

const FLOOR = -5;
const HALF_X = 18;
const HALF_Z = 13;
const CORRIDOR = 2;
const WALL_HEIGHT = 1.3;
const THICK = 0.3;
const DOOR = 2.4;

/** Spots in the building's own coordinates. */
const spots = {
  entrance: { x: 0, z: 9.5 },
  exit: { x: 0, z: 12.4 },
  teacher: { x: -9, z: 0.8 },
  teacherStands: { x: -9, z: -0.8 },
  cubby: { x: -14, z: 0.6 },
  desk: { x: -9, z: -6 },
  seat: { x: -9, z: -5.15 },
  toilet: { x: -13, z: 7 },
  line: { x: 13, z: 3.6 },
  table: { x: 10.2, z: 9 },
  friend: { x: 11.4, z: 9 },
} as const;

/** Where classmates sit: the desks around the child's. */
const OTHER_DESKS = [
  { x: -13, z: -6 },
  { x: -5, z: -6 },
  { x: -9, z: -9.4 },
] as const;

const COLORS = {
  classroom: 0xfff1d0,
  library: 0xdfeaff,
  bathroom: 0xd5f2f0,
  hall: 0xf4efe4,
  canteen: 0xffe2d6,
  corridor: 0xece6da,
} as const;

/** A whole school, open from above like the house: every room can be seen and walked to. */
export class SchoolBuilding implements Zone, WalkableSpace {
  readonly group = new THREE.Group();
  readonly colliders: readonly Collider[] = [];
  readonly places: readonly Interactable[] = [];
  readonly height = FLOOR;
  readonly walkColliders: Collider[] = [];
  readonly study: StudyDesk;
  private readonly desk = new THREE.Group();

  constructor() {
    this.group.position.set(SCHOOL_BUILDING.x, FLOOR, SCHOOL_BUILDING.z);
    this.study = new StudyDesk(this.desk);
    // The desk of the house, turned to face the classroom's board, on the child's desk.
    this.study.group.rotation.y = Math.PI;
    this.study.group.position.set(spots.desk.x - 6.6, 0, spots.desk.z - 0.62);
    this.addGround();
    this.addRooms();
    this.addClassroom();
    this.addLibrary();
    this.addBathroom();
    this.addCanteen();
    this.addSigns();
    // Soft lights, so every room is as bright as a morning at school.
    for (const [x, z] of [
      [-9, -6],
      [9, -6],
      [0, 7],
    ] as const) {
      const light = new THREE.PointLight(0xfff6e0, 26, 26, 1.4);
      light.position.set(x, 6, z);
      this.group.add(light);
    }
    this.group.add(this.study.group, this.desk);
    mergeStatic(this.group, [this.study.group]);
  }

  /** A spot of the building, in the world. */
  at(spot: { readonly x: number; readonly z: number }): THREE.Vector3 {
    return new THREE.Vector3(SCHOOL_BUILDING.x + spot.x, FLOOR, SCHOOL_BUILDING.z + spot.z);
  }

  readonly walkPlaces: readonly Interactable[] = (
    [
      ['escola:teacher', spots.teacher, '👩‍🏫', 'Dizer oi', 'Professora'],
      ['escola:cubby', spots.cubby, '🎒', 'Guardar a mochila', 'Escaninho'],
      ['escola:seat', spots.seat, '✏️', 'Sentar', 'Carteira'],
      ['escola:toilet', spots.toilet, '🚻', 'Usar o banheiro', 'Banheiro'],
      ['escola:line', spots.line, '🍎', 'Entrar na fila', 'Refeitório'],
      ['escola:exit', spots.exit, '🚪', 'Ir para casa', 'Saída'],
    ] as const
  ).map(([id, spot, icon, label, name]) => {
    const position = this.at(spot);
    return {
      id,
      position,
      markerPosition: position.clone().setY(FLOOR + 3),
      radius: 1.6,
      icon,
      label,
      name,
    };
  });

  get entrance(): THREE.Vector3 {
    return this.at(spots.entrance);
  }

  get teacherSpot(): THREE.Vector3 {
    return this.at(spots.teacherStands);
  }

  get seatSpot(): THREE.Vector3 {
    return this.at(spots.seat);
  }

  get tableSpot(): THREE.Vector3 {
    return this.at(spots.table);
  }

  get friendSpot(): THREE.Vector3 {
    return this.at(spots.friend);
  }

  deskOf(index: number): THREE.Vector3 {
    const desk = OTHER_DESKS[index] ?? OTHER_DESKS[0];
    return this.at({ x: desk.x, z: desk.z + 0.85 });
  }

  /** Who stands in the line, from the counter back. The child is the last. */
  linePlace(place: number): THREE.Vector3 {
    return this.at({ x: spots.line.x, z: 9 - place * 1.7 });
  }

  contains(x: number, z: number): boolean {
    return Math.abs(x - SCHOOL_BUILDING.x) < HALF_X && Math.abs(z - SCHOOL_BUILDING.z) < HALF_Z;
  }

  private floor(x: number, z: number, width: number, depth: number, color: number): void {
    this.group.add(solid(new THREE.BoxGeometry(width, 0.1, depth), lowPoly(color), [x, 0.05, z]));
  }

  /** A wall along x or z from `from` to `to`, opening at each door. */
  private wall(axis: 'x' | 'z', at: number, from: number, to: number, doors: readonly number[]) {
    const edges = [from, ...doors.flatMap((door) => [door - DOOR / 2, door + DOOR / 2]), to];
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i] ?? from;
      const b = edges[i + 1] ?? to;
      const length = b - a;
      const middle = (a + b) / 2;
      const [x, z, w, d] = axis === 'x' ? [middle, at, length, THICK] : [at, middle, THICK, length];
      this.group.add(
        solid(new THREE.BoxGeometry(w, WALL_HEIGHT, d), lowPoly(0xf6f1e6), [x, WALL_HEIGHT / 2, z]),
      );
      this.walkColliders.push(box(SCHOOL_BUILDING.x + x, SCHOOL_BUILDING.z + z, w, d));
    }
  }

  private solidBox(x: number, z: number, width: number, depth: number, top: number, color: number) {
    this.group.add(
      solid(new THREE.BoxGeometry(width, top, depth), lowPoly(color), [x, top / 2, z]),
    );
    this.walkColliders.push(box(SCHOOL_BUILDING.x + x, SCHOOL_BUILDING.z + z, width, depth));
  }

  private addGround(): void {
    this.group.add(solid(new THREE.BoxGeometry(120, 0.08, 120), lowPoly(0x8fd07a), [0, -0.02, 0]));
    // The court and the yard behind the building, for the games to come.
    this.floor(0, -24, 30, 18, 0xd9775a);
    this.group.add(solid(new THREE.BoxGeometry(26, 0.02, 0.15), lowPoly(0xffffff), [0, 0.12, -24]));
  }

  private addRooms(): void {
    this.floor(-9, -7.5, 18, 11, COLORS.classroom);
    this.floor(9, -7.5, 18, 11, COLORS.library);
    this.floor(0, 0, 36, CORRIDOR * 2, COLORS.corridor);
    this.floor(-13, 7.5, 10, 11, COLORS.bathroom);
    this.floor(0, 7.5, 16, 11, COLORS.hall);
    this.floor(13, 7.5, 10, 11, COLORS.canteen);
    this.wall('x', -HALF_Z, -HALF_X, HALF_X, []);
    this.wall('z', -HALF_X, -HALF_Z, HALF_Z, []);
    this.wall('z', HALF_X, -HALF_Z, HALF_X - 5, []);
    this.wall('z', HALF_X, HALF_X - 5, HALF_Z, []);
    this.wall('x', HALF_Z, -HALF_X, HALF_X, [0]);
    this.wall('x', -CORRIDOR, -HALF_X, HALF_X, [-9, 9]);
    this.wall('x', CORRIDOR, -HALF_X, HALF_X, [-13, 0, 13]);
    this.wall('z', 0, -HALF_Z, -CORRIDOR, []);
    this.wall('z', -8, CORRIDOR, HALF_Z, []);
    this.wall('z', 8, CORRIDOR, HALF_Z, []);
  }

  private addDesk(x: number, z: number, color: number): void {
    this.solidBox(x, z, 2.2, 0.8, 0.84, color);
    this.group.add(
      solid(new THREE.BoxGeometry(0.55, 0.42, 0.55), lowPoly(0x7ec8a3), [x, 0.21, z + 0.85]),
    );
  }

  private addClassroom(): void {
    this.addDesk(spots.desk.x, spots.desk.z, 0xd08c4a);
    for (const { x, z } of OTHER_DESKS) this.addDesk(x, z, 0xc98a4b);
    // The big board on the far wall, and the teacher's table.
    this.group.add(
      solid(new THREE.BoxGeometry(9, 1.7, 0.1), lowPoly(0x2f5d50), [-9, 1.9, -HALF_Z + 0.25]),
    );
    this.solidBox(-3, -11, 2.4, 0.9, 0.85, 0xa8744a);
    // Cubbies along the corridor.
    for (let i = 0; i < 5; i += 1) {
      this.solidBox(
        -16.4 + i * 1.3,
        CORRIDOR - 0.55,
        1.2,
        0.5,
        1.05,
        i % 2 === 0 ? 0xffc93c : 0x3fa9f5,
      );
    }
  }

  private addLibrary(): void {
    const colors = [0xe8604c, 0x3fae5a, 0x3f7fd6, 0xffc93c, 0x9b6bf2];
    for (const z of [-11.8, -8.6]) {
      this.solidBox(9, z, 12, 0.6, 1.9, 0xc98a4b);
      colors.forEach((color, index) => {
        this.group.add(
          solid(new THREE.BoxGeometry(1.8, 0.5, 0.1), lowPoly(color), [
            4.8 + index * 2.1,
            1.3,
            z + 0.34,
          ]),
        );
      });
    }
    this.solidBox(9, -4.8, 1.8, 1.8, 0.1, 0x7ec8a3);
  }

  private addBathroom(): void {
    for (const x of [-16, -13, -10]) this.solidBox(x, 11.8, 2.2, 0.8, 1.2, 0x8fd3f4);
    for (const x of [-16, -13, -10]) {
      this.group.add(
        solid(new THREE.BoxGeometry(0.8, 0.3, 0.5), lowPoly(0xffffff), [x, 1.3, 11.6]),
      );
    }
  }

  private addCanteen(): void {
    this.solidBox(13, 11.6, 9, 1, 1, 0x3fae5a);
    this.solidBox(10.8, 10.2, 3, 1, 0.74, 0xd08c4a);
  }

  private addSigns(): void {
    const signs: readonly [string, string, number, number][] = [
      ['✏️ Sala', '#ff8a3d', -9, -2],
      ['📚 Biblioteca', '#3f7fd6', 9, -2],
      ['🚻 Banheiro', '#3fa9b4', -13, 2],
      ['🍎 Refeitório', '#3fae5a', 13, 2],
    ];
    for (const [text, background, x, z] of signs) {
      const sign = createSign([text], { background, color: '#ffffff', width: 2.6, height: 0.6 });
      sign.position.set(x, 2.1, z);
      this.group.add(sign);
    }
  }
}
