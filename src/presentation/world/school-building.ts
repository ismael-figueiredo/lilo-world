import * as THREE from 'three';
import { box, type Collider } from '@presentation/world/collision';
import type { WalkableSpace } from '@presentation/world/game-world';
import type { Interactable } from '@presentation/world/interactable';
import { SCHOOL_BUILDING } from '@presentation/world/market-position';
import { lowPoly, solid } from '@presentation/world/materials';
import { mergeStatic } from '@presentation/world/merge-static';
import { slide, swings } from '@presentation/world/props';
import { HOPSCOTCH_SQUARES } from '@domain/play/games';
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
const YARD_HALF_X = 23;
const YARD_NORTH = -34;

/** Spots in the building's own coordinates. */
const spots = {
  entrance: { x: 0, z: 9.5 },
  exit: { x: 0, z: 12.4 },
  teacher: { x: -9, z: 0.8 },
  teacherStands: { x: -9, z: -0.8 },
  cubby: { x: -14, z: -0.3 },
  desk: { x: -9, z: -6 },
  seat: { x: -9, z: -5.15 },
  toilet: { x: -13, z: 7 },
  line: { x: 13, z: 3.6 },
  table: { x: 10.2, z: 9 },
  friend: { x: 11.4, z: 9 },
  yardDoor: { x: 16.4, z: 0 },
} as const;

/** The yard, behind the building: the court, the playground and the games. */
const yard = {
  arrive: { x: 0, z: -17 },
  back: { x: 3, z: -15.8 },
  hoop: { x: -10, z: -30 },
  shoot: { x: -10, z: -24.5 },
  goal: { x: 10, z: -31 },
  kick: { x: 10, z: -25 },
  friend: { x: 7, z: -22 },
  hopscotch: { x: -3, z: -19 },
  catch: { x: 2.5, z: -22 },
  rope: { x: -2, z: -27 },
  swing: { x: 15, z: -18 },
  slide: { x: 19, z: -24 },
  seesaw: { x: 15.5, z: -30 },
  hide: { x: 0, z: -31 },
} as const;

const HOP_GAP = 1.05;

/** Where friends hide: always with part of them in sight. */
const hidingSpots: readonly { readonly x: number; readonly z: number }[] = [
  { x: -16, z: -18 },
  { x: -16, z: -31 },
  { x: 6, z: -32 },
  { x: 20, z: -17 },
];

const gamePlaces = [
  ['play:basket', yard.shoot, '🏀', 'Jogar basquete', 'Basquete'],
  ['play:soccer', yard.kick, '⚽', 'Jogar futebol', 'Futebol'],
  ['play:hide', yard.hide, '🙈', 'Esconde-esconde', 'Esconde-esconde'],
  ['play:hopscotch', yard.hopscotch, '🔢', 'Amarelinha', 'Amarelinha'],
  ['play:catch', yard.catch, '🤾', 'Pega-bola', 'Pega-bola'],
  ['play:rope', yard.rope, '🪢', 'Pular corda', 'Corda'],
  ['play:swing', yard.swing, '🛝', 'Balanço', 'Balanço'],
  ['play:slide', yard.slide, '🛝', 'Escorregador', 'Escorregador'],
  ['play:seesaw', yard.seesaw, '⚖️', 'Gangorra', 'Gangorra'],
] as const;

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
  /** Everybody plays with the same ball. */
  readonly ball = solid(new THREE.IcosahedronGeometry(0.24, 1), lowPoly(0xf08a3c), [0, 0.3, -24]);

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
    this.addYard();
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
    this.group.add(this.study.group, this.desk, this.ball);
    mergeStatic(this.group, [this.study.group, this.ball]);
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
      ['escola:yard', spots.yardDoor, '⛹️', 'Ir para o pátio', 'Pátio'],
      ...gamePlaces,
      ['play:back', yard.back, '🔔', 'Voltar para a sala', 'Voltar'],
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
    const dx = Math.abs(x - SCHOOL_BUILDING.x);
    const dz = z - SCHOOL_BUILDING.z;
    const inside = dx < HALF_X && Math.abs(dz) < HALF_Z;
    const inYard = dx < YARD_HALF_X && dz > YARD_NORTH && dz < -HALF_Z - 1;
    return inside || inYard;
  }

  /** A spot of the yard, by name, in the world. */
  yardSpot(name: keyof typeof yard): THREE.Vector3 {
    return this.at(yard[name]);
  }

  /** The middle of a hopscotch square, from 1. */
  hopSquare(square: number): THREE.Vector3 {
    return this.at({ x: yard.hopscotch.x, z: yard.hopscotch.z - square * HOP_GAP });
  }

  get hideSpots(): readonly THREE.Vector3[] {
    return hidingSpots.map((spot) => this.at(spot));
  }

  /** Where the ball goes in, in the world. */
  get hoop(): THREE.Vector3 {
    return this.at(yard.hoop).setY(FLOOR + 3);
  }

  get goal(): THREE.Vector3 {
    return this.at(yard.goal).setY(FLOOR + 0.8);
  }

  /** Puts the ball anywhere in the world. */
  moveBall(x: number, y: number, z: number): void {
    this.ball.position.set(x - SCHOOL_BUILDING.x, y - FLOOR, z - SCHOOL_BUILDING.z);
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
    this.wall('z', HALF_X, -HALF_Z, HALF_Z, []);
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
    // Cubbies on the corridor's wall without doors, beside the classroom's door.
    for (let i = 0; i < 5; i += 1) {
      this.solidBox(
        -16.4 + i * 1.3,
        -CORRIDOR + 0.45,
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
    // A rug to sit on: it is only the floor.
    this.group.add(
      solid(new THREE.BoxGeometry(1.8, 0.04, 1.8), lowPoly(0x7ec8a3), [9, 0.12, -4.8]),
    );
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

  private addYard(): void {
    this.floor(0, -24, 44, 19, 0xcfe8b8);
    this.group.add(
      solid(new THREE.BoxGeometry(15, 0.04, 12), lowPoly(0xd9775a), [-10, 0.12, -26]),
      solid(new THREE.BoxGeometry(15, 0.04, 12), lowPoly(0x6fb56a), [10, 0.12, -26]),
    );
    // The hoop, on a pole.
    const { x: hoopX, z: hoopZ } = yard.hoop;
    this.solidBox(hoopX, hoopZ - 0.5, 0.3, 0.3, 3.2, 0x8a8f99);
    this.group.add(
      solid(new THREE.BoxGeometry(1.6, 1, 0.08), lowPoly(0xffffff), [hoopX, 3.5, hoopZ - 0.4]),
    );
    const ring = solid(new THREE.TorusGeometry(0.42, 0.05, 8, 20), lowPoly(0xe8504c), [
      hoopX,
      3,
      hoopZ,
    ]);
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);
    // The goal.
    const { x: goalX, z: goalZ } = yard.goal;
    for (const dx of [-2, 2]) this.solidBox(goalX + dx, goalZ, 0.14, 0.14, 1.8, 0xffffff);
    this.group.add(
      solid(new THREE.BoxGeometry(4.14, 0.14, 0.14), lowPoly(0xffffff), [goalX, 1.8, goalZ]),
    );
    // Hopscotch: numbers on the ground.
    for (let square = 1; square <= HOPSCOTCH_SQUARES; square += 1) {
      const sign = createSign([String(square)], {
        background: square % 2 === 0 ? '#3fa9f5' : '#ffc93c',
        color: '#ffffff',
        width: 0.95,
        height: 0.95,
      });
      sign.rotation.x = -Math.PI / 2;
      sign.position.set(yard.hopscotch.x, 0.16, yard.hopscotch.z - square * HOP_GAP);
      this.group.add(sign);
    }
    // The playground.
    const seat = swings();
    seat.position.set(yard.swing.x, 0, yard.swing.z - 1.6);
    const chute = slide();
    chute.position.set(yard.slide.x, 0, yard.slide.z - 1.6);
    this.group.add(seat, chute);
    this.solidBox(yard.seesaw.x, yard.seesaw.z - 1.4, 0.4, 0.4, 0.5, 0x8a8f99);
    this.group.add(
      solid(new THREE.BoxGeometry(3.4, 0.1, 0.4), lowPoly(0xe8604c), [
        yard.seesaw.x,
        0.55,
        yard.seesaw.z - 1.4,
      ]),
    );
    // Bushes and a shed to hide behind, low enough to always show a head.
    for (const { x, z } of hidingSpots) {
      this.group.add(
        solid(new THREE.IcosahedronGeometry(0.85, 0), lowPoly(0x4f9d4a), [x, 0.6, z + 0.75]),
      );
    }
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
