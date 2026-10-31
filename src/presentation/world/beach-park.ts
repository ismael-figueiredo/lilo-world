import * as THREE from 'three';
import type { SeaFlag, ShellColor } from '@domain/beach/beach';
import { shellLooks } from '@domain/beach/beach';
import { box, circle, type Collider } from '@presentation/world/collision';
import type { WalkableSpace } from '@presentation/world/game-world';
import type { Interactable } from '@presentation/world/interactable';
import { BEACH_PARK } from '@presentation/world/market-position';
import { lowPoly, solid } from '@presentation/world/materials';
import { mergeStatic } from '@presentation/world/merge-static';
import type { Zone } from '@presentation/world/zones/zone';

const FLOOR = -5;
const HALF_X = 26;
/** Sand is south of this line. North of it, the sea. */
const SHORE = -4;
/** The buoys: no step of the child can ever go beyond them. */
export const SHALLOW_LIMIT = -9;
const SOUTH = 16;

/** The beach, seen from the sand: the sea stops at a line of buoys nobody crosses. */
export class BeachPark implements Zone, WalkableSpace {
  readonly group = new THREE.Group();
  readonly colliders: readonly Collider[] = [];
  readonly places: readonly Interactable[] = [];
  readonly height = FLOOR;
  readonly walkColliders: Collider[] = [];
  readonly walkPlaces: Interactable[] = [];
  private readonly castle = new THREE.Group();
  private readonly shells = new THREE.Group();
  private readonly flag: THREE.Mesh;
  private readonly water: THREE.Mesh;

  constructor() {
    this.group.position.set(BEACH_PARK.x, FLOOR, BEACH_PARK.z);
    this.flag = solid(new THREE.BoxGeometry(1, 0.6, 0.04), lowPoly(0x3fae5a), [9.5, 3.4, -1]);
    this.water = solid(
      new THREE.BoxGeometry(160, 0.06, 90),
      new THREE.MeshStandardMaterial({
        color: 0x4fb4e8,
        transparent: true,
        opacity: 0.75,
      }),
      [0, 0.1, SHORE - 45],
    );
    this.addGround();
    this.addFurniture();
    this.group.add(this.flag, this.water, this.castle, this.shells);
    this.addPlaces();
    mergeStatic(this.group, [this.flag, this.water, this.castle, this.shells]);
  }

  private at(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(BEACH_PARK.x + x, FLOOR, BEACH_PARK.z + z);
  }

  private addGround(): void {
    this.group.add(
      solid(new THREE.BoxGeometry(160, 0.1, 120), lowPoly(0xf2dfae), [0, 0, 56]),
      solid(new THREE.BoxGeometry(160, 0.1, 90), lowPoly(0xd9c48e), [0, -0.3, SHORE - 45]),
    );
    for (let x = -HALF_X; x <= HALF_X; x += 4) {
      this.group.add(
        solid(new THREE.SphereGeometry(0.3, 8, 6), lowPoly(0xffa63c), [x, 0.3, SHALLOW_LIMIT]),
      );
    }
  }

  private addFurniture(): void {
    // The lifeguard's tower, with the sea flag on top.
    this.group.add(
      solid(new THREE.BoxGeometry(2, 0.2, 2), lowPoly(0xffffff), [9.5, 2.1, -1]),
      solid(new THREE.BoxGeometry(2, 1.1, 0.1), lowPoly(0xe8504c), [9.5, 2.75, -0.05]),
      solid(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), lowPoly(0x8a8f99), [9.5, 2, -1.5]),
    );
    for (const [x, z] of [
      [8.7, -1.8],
      [10.3, -1.8],
      [8.7, -0.2],
      [10.3, -0.2],
    ] as const) {
      this.group.add(
        solid(new THREE.CylinderGeometry(0.08, 0.08, 2.1, 6), lowPoly(0xffffff), [x, 1.05, z]),
      );
    }
    this.walkColliders.push(box(BEACH_PARK.x + 9.5, BEACH_PARK.z - 1, 2, 2));
    // The kiosk.
    this.group.add(
      solid(new THREE.BoxGeometry(4, 1.2, 2.4), lowPoly(0x3fae5a), [-13, 0.6, 9]),
      solid(new THREE.ConeGeometry(3.6, 1.4, 6), lowPoly(0xd9a85c), [-13, 3.2, 9]),
      solid(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 6), lowPoly(0x8a5a3b), [-13, 1.3, 9]),
    );
    this.walkColliders.push(box(BEACH_PARK.x - 13, BEACH_PARK.z + 9, 4, 2.4));
    // Umbrellas.
    for (const [x, z, color] of [
      [-4, 9, 0xe8504c],
      [4, 11, 0x3f7fd6],
      [14, 9, 0xffc93c],
    ] as const) {
      this.group.add(
        solid(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), lowPoly(0xffffff), [x, 1.2, z]),
        solid(new THREE.ConeGeometry(1.5, 0.7, 8), lowPoly(color), [x, 2.5, z]),
      );
      this.walkColliders.push(circle(BEACH_PARK.x + x, BEACH_PARK.z + z, 0.2));
    }
  }

  private addPlaces(): void {
    const place = (id: string, x: number, z: number, icon: string, label: string) => {
      const position = this.at(x, z);
      this.walkPlaces.push({
        id,
        position,
        markerPosition: position.clone().setY(FLOOR + 3.4),
        radius: 1.9,
        icon,
        label,
        name: label,
      });
    };
    place('beach:castle', -6, 4, '🏰', 'Castelo de areia');
    place('beach:ball', 3, 4, '🏐', 'Jogar bola');
    place('beach:shells', -16, 2, '🐚', 'Procurar conchas');
    place('beach:water', 2, -2.5, '🌊', 'Ir para a água');
    place('beach:kiosk', -13, 11, '🥥', 'Quiosque');
    place('beach:exit', 0, 14.5, '🚌', 'Voltar para casa');
  }

  get entrance(): THREE.Vector3 {
    return this.at(0, 12);
  }

  get shallow(): THREE.Vector3 {
    return this.at(2, -6);
  }

  contains(x: number, z: number): boolean {
    const dz = z - BEACH_PARK.z;
    return Math.abs(x - BEACH_PARK.x) < HALF_X && dz > SHALLOW_LIMIT + 0.5 && dz < SOUTH;
  }

  showFlag(flag: SeaFlag): void {
    (this.flag.material as THREE.MeshStandardMaterial).color.setHex(
      flag === 'green' ? 0x3fae5a : 0xffc93c,
    );
  }

  /** The bucket's towers, one more each time, and what crowns them. */
  addTower(index: number): void {
    const tower = solid(new THREE.CylinderGeometry(0.42, 0.55, 0.8, 10), lowPoly(0xe6cf8f), [
      -6.6 + index * 0.9,
      0.45,
      2.6,
    ]);
    this.castle.add(tower);
  }

  decorateCastle(color: number): void {
    for (const tower of [...this.castle.children]) {
      const top = solid(new THREE.ConeGeometry(0.2, 0.3, 6), lowPoly(color), [
        tower.position.x,
        1,
        tower.position.z,
      ]);
      this.castle.add(top);
    }
  }

  clearCastle(): void {
    this.castle.clear();
  }

  layShells(shells: readonly ShellColor[]): void {
    this.shells.clear();
    shells.forEach((color, index) => {
      const shell = solid(new THREE.SphereGeometry(0.18, 8, 6), lowPoly(shellLooks[color].hex), [
        -18 + (index % 4) * 1.3,
        0.14,
        3.6 + Math.floor(index / 4) * 1.2,
      ]);
      shell.scale.y = 0.5;
      this.shells.add(shell);
    });
  }

  update(time: number): void {
    this.water.position.y = 0.1 + Math.sin(time * 0.9) * 0.05;
  }
}
