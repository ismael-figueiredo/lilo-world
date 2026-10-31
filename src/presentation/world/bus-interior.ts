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
const HEIGHT = 2.5;
const SEAT_ROWS = [-3.2, -1.6, 0, 1.6] as const;
const SILL = 1.15;
const PANE_TOP = 2.25;
const PANES = 5;

/** Each layer is further away and slides slower, as a real landscape does. */
const LAYERS = [
  { depth: 1.6, height: 4, speed: 0.34 },
  { depth: 9, height: 5, speed: 0.06 },
  { depth: 26, height: 22, speed: 0.012 },
] as const;

function canvasLayer(paint: (context: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.scale(2, 2);
    paint(context);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/** What passes right by the window: lamp posts, bushes and trees. */
const nearLayer = (): THREE.CanvasTexture =>
  canvasLayer((context) => {
    for (let x = 90; x < 1024; x += 300) {
      context.fillStyle = '#4a5468';
      context.fillRect(x, 30, 12, 226);
      context.fillRect(x, 30, 60, 10);
      context.fillStyle = '#ffe9a8';
      context.beginPath();
      context.arc(x + 62, 44, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#5aa35a';
      context.beginPath();
      context.arc(x + 170, 206, 46, 0, Math.PI * 2);
      context.arc(x + 214, 216, 36, 0, Math.PI * 2);
      context.fill();
    }
  });

/** The houses of the street, with their doors and windows. */
const streetLayer = (): THREE.CanvasTexture =>
  canvasLayer((context) => {
    const walls = ['#ffd6a5', '#bde0fe', '#ffc8dd', '#c8f2c2', '#fff1a8', '#e3b8ff'];
    const roofs = ['#e8604c', '#3f7fd6', '#9b6bf2', '#3fae5a'];
    walls.forEach((wall, index) => {
      const x = 16 + index * 170;
      const tall = index % 2 === 0 ? 0 : 26;
      context.fillStyle = wall;
      context.fillRect(x, 100 - tall, 136, 156 + tall);
      context.fillStyle = roofs[index % roofs.length] ?? '#e8604c';
      context.beginPath();
      context.moveTo(x - 12, 100 - tall);
      context.lineTo(x + 68, 44 - tall);
      context.lineTo(x + 148, 100 - tall);
      context.fill();
      context.fillStyle = '#8fc4e8';
      context.fillRect(x + 18, 128, 34, 34);
      context.fillRect(x + 84, 128, 34, 34);
      context.fillStyle = '#8a5a3b';
      context.fillRect(x + 54, 188, 30, 68);
      context.fillStyle = '#4f9a56';
      context.beginPath();
      context.arc(x + 156, 182, 26, 0, Math.PI * 2);
      context.fill();
    });
  });

/** The sky and the hills, far behind everything. */
const farLayer = (): THREE.CanvasTexture =>
  canvasLayer((context) => {
    const sky = context.createLinearGradient(0, 0, 0, 200);
    sky.addColorStop(0, '#7cc4f0');
    sky.addColorStop(1, '#d6eefb');
    context.fillStyle = sky;
    context.fillRect(0, 0, 1024, 256);
    context.fillStyle = '#ffffff';
    for (const [x, y] of [
      [120, 50],
      [440, 34],
      [780, 62],
    ] as const) {
      context.beginPath();
      context.ellipse(x, y, 62, 18, 0, 0, Math.PI * 2);
      context.ellipse(x + 40, y - 10, 42, 16, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#8fd07a';
    context.beginPath();
    context.moveTo(0, 190);
    for (let x = 0; x <= 1024; x += 16) {
      context.lineTo(x, 170 + Math.sin((x / 1024) * Math.PI * 4) * 30);
    }
    context.lineTo(1024, 256);
    context.lineTo(0, 256);
    context.fill();
  });

/** Inside the bus, far from the island: seats, a driver and real depth outside. */
export class BusInterior implements Zone, WalkableSpace {
  readonly group = new THREE.Group();
  readonly colliders: readonly Collider[] = [];
  readonly places: readonly Interactable[] = [];
  readonly walkColliders: readonly Collider[] = [];
  readonly walkPlaces: readonly Interactable[] = [];
  readonly height = FLOOR;
  private readonly cabin = new THREE.Group();
  private readonly views: readonly THREE.CanvasTexture[] = [nearLayer(), streetLayer(), farLayer()];
  private moving = false;

  constructor() {
    this.group.position.set(BUS_INTERIOR.x, FLOOR, BUS_INTERIOR.z);
    this.addCabin();
    this.addSeats();
    this.addRails();
    this.addOutside();
    this.group.add(this.cabin);
    mergeStatic(this.cabin);
  }

  private addCabin(): void {
    const { cabin } = this;
    const yellow = lowPoly(0xffb02e);
    const trim = lowPoly(0xf4efe4);
    cabin.add(
      solid(new THREE.BoxGeometry(LENGTH, 0.1, WIDTH), lowPoly(0x5b6478), [0, 0, 0]),
      solid(new THREE.BoxGeometry(0.1, HEIGHT, WIDTH), yellow, [-LENGTH / 2, HEIGHT / 2, 0]),
      solid(new THREE.BoxGeometry(0.1, 0.9, WIDTH), yellow, [LENGTH / 2, 0.45, 0]),
      solid(new THREE.BoxGeometry(LENGTH, 0.1, WIDTH), trim, [0, HEIGHT, 0]),
    );
    for (const z of [-WIDTH / 2, WIDTH / 2]) {
      cabin.add(
        solid(new THREE.BoxGeometry(LENGTH, SILL, 0.1), yellow, [0, SILL / 2, z]),
        solid(new THREE.BoxGeometry(LENGTH, HEIGHT - PANE_TOP, 0.1), yellow, [
          0,
          (HEIGHT + PANE_TOP) / 2,
          z,
        ]),
        solid(new THREE.BoxGeometry(LENGTH, 0.06, 0.16), trim, [0, SILL, z]),
      );
      // Pillars between the panes: what is outside passes behind them.
      for (let pane = 0; pane <= PANES; pane += 1) {
        const x = -LENGTH / 2 + (pane / PANES) * LENGTH;
        cabin.add(
          solid(new THREE.BoxGeometry(0.16, PANE_TOP - SILL, 0.12), yellow, [
            x,
            (PANE_TOP + SILL) / 2,
            z,
          ]),
        );
      }
    }
    // Lights along the ceiling.
    for (const x of [-3, 0, 3]) {
      cabin.add(
        solid(
          new THREE.BoxGeometry(1.2, 0.04, 0.3),
          lowPoly(0xfff6d8, { emissive: 0xfff2c0, emissiveIntensity: 0.8 }),
          [x, HEIGHT - 0.07, 0],
        ),
      );
    }
    const light = new THREE.PointLight(0xfff4dc, 12, 12, 1.5);
    light.position.set(0, HEIGHT - 0.3, 0);
    this.group.add(light);
  }

  private addSeats(): void {
    const seat = lowPoly(0x3f7fd6);
    const cushion = lowPoly(0x5a97e6);
    const metal = lowPoly(0xc9ced8);
    for (const x of SEAT_ROWS) {
      for (const z of [-0.85, 0.85]) {
        this.cabin.add(
          solid(new THREE.BoxGeometry(0.62, 0.14, 0.92), cushion, [x, 0.48, z]),
          solid(new THREE.BoxGeometry(0.5, 0.42, 0.8), seat, [x, 0.22, z]),
          solid(new THREE.BoxGeometry(0.12, 0.86, 0.92), seat, [x - 0.3, 0.9, z]),
          solid(new THREE.BoxGeometry(0.06, 0.06, 0.8), metal, [x - 0.3, 1.38, z]),
        );
      }
    }
  }

  private addRails(): void {
    const rail = lowPoly(0xffd23f);
    const pole = (x: number, z: number) =>
      solid(new THREE.CylinderGeometry(0.03, 0.03, HEIGHT, 8), rail, [x, HEIGHT / 2, z]);
    this.cabin.add(
      pole(2.6, 0.35),
      pole(-0.8, 0.35),
      pole(-0.8, -0.35),
      solid(new THREE.BoxGeometry(LENGTH - 1, 0.04, 0.04), rail, [0, 2.1, 0.32]),
      solid(new THREE.BoxGeometry(LENGTH - 1, 0.04, 0.04), rail, [0, 2.1, -0.32]),
      // The card reader and the stop button, by the door.
      solid(new THREE.BoxGeometry(0.2, 1.1, 0.2), lowPoly(0x2d3142), [3.2, 0.55, 0.7]),
      solid(new THREE.BoxGeometry(0.34, 0.26, 0.1), lowPoly(0x5fd38a), [3.2, 1.2, 0.7]),
      solid(new THREE.BoxGeometry(0.1, 0.1, 0.06), lowPoly(0xe8504c), [-0.8, 1.5, -0.32]),
    );
  }

  /** Three flat layers at real distances, seen through the panes. */
  private addOutside(): void {
    LAYERS.forEach(({ depth, height }, index) => {
      const view = this.views[index];
      const width = 60 + depth * 4;
      // The picture repeats along the street, at its true size.
      if (view !== undefined) view.repeat.x = width / (height * 4);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ map: view ?? null, transparent: index < 2 }),
      );
      plane.position.set(0, 0.1 + height / 2, -WIDTH / 2 - depth);
      this.group.add(plane);
    });
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 34),
      new THREE.MeshBasicMaterial({ color: 0x6d7686 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.02, -18);
    this.group.add(road);
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

  /** Beside the window, where the view is best. */
  get seat(): THREE.Vector3 {
    return this.spot(0.1, -0.85);
  }

  seatOf(index: number): THREE.Vector3 {
    const rows = [-1.5, 1.7, -3.1];
    return this.spot(rows[index] ?? 0, -0.85);
  }

  get driver(): THREE.Vector3 {
    return this.spot(4, -0.7);
  }

  get camera(): { position: THREE.Vector3; lookAt: THREE.Vector3 } {
    const position = this.spot(1.5, 1.2);
    position.y += 1.75;
    const lookAt = this.spot(-0.7, -1.3);
    lookAt.y += 1.35;
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

  update(time: number, dt: number): void {
    if (!this.moving) return;
    LAYERS.forEach(({ speed }, index) => {
      const view = this.views[index];
      if (view !== undefined) view.offset.x = (view.offset.x + speed * dt) % 1;
    });
    // A bus sways a little on the road.
    this.cabin.rotation.x = Math.sin(time * 1.7) * 0.004;
    this.cabin.position.y = Math.abs(Math.sin(time * 3.1)) * 0.012;
  }
}
