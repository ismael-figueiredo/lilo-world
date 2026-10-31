import * as THREE from 'three';
import type { Collider } from '@presentation/world/collision';
import type { WalkableSpace } from '@presentation/world/game-world';
import type { Interactable } from '@presentation/world/interactable';
import { BUS_INTERIOR } from '@presentation/world/market-position';
import { lowPoly, solid } from '@presentation/world/materials';
import { mergeStatic } from '@presentation/world/merge-static';
import type { Zone } from '@presentation/world/zones/zone';

const FLOOR = -5;
const LENGTH = 9;
const WIDTH = 2.8;
const SEAT_ROWS = [-3.2, -1.6, 0, 1.6] as const;
const WINDOW = { y: 1.75, height: 1, z: -WIDTH / 2 + 0.06 } as const;
/** How fast the landscape goes by, in turns of the picture per second. */
const LANDSCAPE_SPEED = 0.07;

/** Hills, houses and trees, painted once: the window slides over them. */
function landscape(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.fillStyle = '#a8def5';
    context.fillRect(0, 0, 1024, 256);
    context.fillStyle = '#8fd07a';
    context.beginPath();
    context.moveTo(0, 150);
    for (let x = 0; x <= 1024; x += 16) {
      context.lineTo(x, 150 + Math.sin((x / 1024) * Math.PI * 6) * 26);
    }
    context.lineTo(1024, 256);
    context.lineTo(0, 256);
    context.fill();
    context.fillStyle = '#6d7686';
    context.fillRect(0, 214, 1024, 42);
    const houses = ['#ffd6a5', '#bde0fe', '#ffc8dd', '#c8f2c2', '#fff1a8'];
    houses.forEach((wall, index) => {
      const x = 60 + index * 200;
      context.fillStyle = wall;
      context.fillRect(x, 130, 90, 84);
      context.fillStyle = '#e8604c';
      context.beginPath();
      context.moveTo(x - 10, 130);
      context.lineTo(x + 45, 92);
      context.lineTo(x + 100, 130);
      context.fill();
      context.fillStyle = '#4f9a56';
      context.beginPath();
      context.arc(x + 150, 150, 30, 0, Math.PI * 2);
      context.fill();
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/** Inside the bus, far from the island: seats, a driver and a window on the way. */
export class BusInterior implements Zone, WalkableSpace {
  readonly group = new THREE.Group();
  readonly colliders: readonly Collider[] = [];
  readonly places: readonly Interactable[] = [];
  readonly walkColliders: readonly Collider[] = [];
  readonly walkPlaces: readonly Interactable[] = [];
  readonly height = FLOOR;
  private readonly view = landscape();
  private moving = false;

  constructor() {
    this.group.position.set(BUS_INTERIOR.x, FLOOR, BUS_INTERIOR.z);
    this.group.add(solid(new THREE.BoxGeometry(LENGTH, 0.1, WIDTH), lowPoly(0x5b6478), [0, 0, 0]));
    const yellow = lowPoly(0xffb02e);
    for (const z of [-WIDTH / 2, WIDTH / 2]) {
      this.group.add(solid(new THREE.BoxGeometry(LENGTH, 1.2, 0.1), yellow, [0, 0.6, z]));
    }
    this.group.add(
      solid(new THREE.BoxGeometry(0.1, 2.6, WIDTH), yellow, [-LENGTH / 2, 1.3, 0]),
      solid(new THREE.BoxGeometry(0.1, 0.9, WIDTH), yellow, [LENGTH / 2, 0.45, 0]),
      solid(new THREE.BoxGeometry(LENGTH, 0.4, 0.1), yellow, [0, 2.45, -WIDTH / 2]),
    );
    const seat = lowPoly(0x3f7fd6);
    for (const x of SEAT_ROWS) {
      for (const z of [-0.8, 0.8]) {
        this.group.add(
          solid(new THREE.BoxGeometry(0.6, 0.45, 0.9), seat, [x, 0.27, z]),
          solid(new THREE.BoxGeometry(0.12, 0.8, 0.9), seat, [x - 0.28, 0.8, z]),
        );
      }
    }
    // The card reader and the stop button, by the door.
    this.group.add(
      solid(new THREE.BoxGeometry(0.2, 1.1, 0.2), lowPoly(0x2d3142), [3.2, 0.55, 0.7]),
      solid(new THREE.BoxGeometry(0.34, 0.26, 0.1), lowPoly(0x5fd38a), [3.2, 1.2, 0.7]),
    );
    const sight = new THREE.Mesh(
      new THREE.PlaneGeometry(LENGTH - 0.3, WINDOW.height),
      new THREE.MeshBasicMaterial({ map: this.view }),
    );
    sight.position.set(0, WINDOW.y, WINDOW.z);
    this.group.add(sight);
    mergeStatic(this.group, [sight]);
  }

  private spot(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(BUS_INTERIOR.x + x, FLOOR, BUS_INTERIOR.z + z);
  }

  get entrance(): THREE.Vector3 {
    return this.spot(3.6, 0);
  }

  get reader(): THREE.Vector3 {
    return this.spot(2.8, 0.1);
  }

  /** Beside the window, in the last rows where the view is best. */
  get seat(): THREE.Vector3 {
    return this.spot(0.1, -0.8);
  }

  seatOf(index: number): THREE.Vector3 {
    const rows = [-1.5, 1.7, -3.1];
    return this.spot(rows[index] ?? 0, -0.8);
  }

  get driver(): THREE.Vector3 {
    return this.spot(4, -0.7);
  }

  get camera(): { position: THREE.Vector3; lookAt: THREE.Vector3 } {
    const position = this.spot(1.2, 1.1);
    position.y += 2;
    const lookAt = this.spot(-0.8, -1.3);
    lookAt.y += 1.1;
    return { position, lookAt };
  }

  contains(x: number, z: number): boolean {
    return (
      Math.abs(x - BUS_INTERIOR.x) < LENGTH / 2 + 1 && Math.abs(z - BUS_INTERIOR.z) < WIDTH / 2 + 1
    );
  }

  setMoving(moving: boolean): void {
    this.moving = moving;
  }

  update(_time: number, dt: number): void {
    if (this.moving) this.view.offset.x = (this.view.offset.x + LANDSCAPE_SPEED * dt) % 1;
  }
}
