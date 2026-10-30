import * as THREE from 'three';
import type { MissionChoice } from '@domain/mission/mission';
import { lowPoly, solid } from '@presentation/world/materials';
import { createSign } from '@presentation/world/sign';

/**
 * Inside the market. It stands far beyond the sea, where nothing else can be
 * seen, and the game moves the child here behind a fade.
 */
export const MARKET_INTERIOR = { x: 0, z: 460 } as const;

const ROOM = { width: 16, depth: 11, height: 6 } as const;
const SHELF_Z = -ROOM.depth / 2 + 0.9;
const SHELF_LEVELS = [0.75, 1.55, 2.35] as const;
const SHELF_XS = [-4.6, 0, 4.6] as const;
const COUNTER = { x: 5.6, z: 2.4 } as const;
const CART = { x: 1.4, z: -1.6 } as const;
const FLIGHT_SECONDS = 0.8;

interface Item {
  readonly sprite: THREE.Sprite;
  readonly home: THREE.Vector3;
}

interface Flight {
  readonly sprite: THREE.Sprite;
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
  age: number;
}

const textures = new Map<string, THREE.CanvasTexture>();

/** A picture (emoji) drawn once on a canvas and reused. */
function pictureTexture(picture: string): THREE.CanvasTexture {
  let texture = textures.get(picture);
  if (texture === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context !== null) {
      context.font = '104px system-ui, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(picture, 64, 72);
    }
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.set(picture, texture);
  }
  return texture;
}

/** Shelves with today's groceries, a shopping cart and the cashier's counter. */
export class MarketInterior {
  readonly group = new THREE.Group();
  private readonly items = new Map<string, Item>();
  private readonly flights: Flight[] = [];
  private inCart = 0;
  private hinted: string | undefined;

  constructor(private readonly floor: number) {
    this.group.position.set(MARKET_INTERIOR.x, floor, MARKET_INTERIOR.z);
    this.addRoom();
    this.addShelves();
    this.addCart();
    this.addCounter();
  }

  /** Local position to the world. */
  private world(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(MARKET_INTERIOR.x + x, this.floor + y, MARKET_INTERIOR.z + z);
  }

  /** Where the child stands with the cart, facing the shelves. */
  get shopperSpot(): THREE.Vector3 {
    return this.world(0, 0, -1.4);
  }

  /** The panel covers the lower half of the screen, so the shelves are framed above it. */
  get shelfCamera(): { position: THREE.Vector3; lookAt: THREE.Vector3 } {
    return { position: this.world(0, 4.2, 6.4), lookAt: this.world(0, -0.6, 0.4) };
  }

  /** In front of the counter, facing the cashier. */
  get checkoutSpot(): THREE.Vector3 {
    return this.world(COUNTER.x - 1.7, 0, COUNTER.z);
  }

  /** Behind the counter. */
  get cashierSpot(): THREE.Vector3 {
    return this.world(COUNTER.x + 1.1, 0, COUNTER.z);
  }

  get checkoutCamera(): { position: THREE.Vector3; lookAt: THREE.Vector3 } {
    return {
      position: this.world(COUNTER.x - 4.4, 3.6, COUNTER.z + 4.2),
      lookAt: this.world(COUNTER.x + 0.6, -0.2, COUNTER.z - 0.4),
    };
  }

  /** Puts today's groceries on the shelves (and empties the cart). */
  stock(choices: readonly MissionChoice[]): void {
    for (const item of this.items.values()) this.group.remove(item.sprite);
    this.items.clear();
    this.flights.length = 0;
    this.inCart = 0;
    this.hinted = undefined;
    const slots = SHELF_LEVELS.flatMap((y) => SHELF_XS.map((x) => [x, y] as const));
    choices.forEach((choice, index) => {
      const [x, y] = slots[index] ?? slots[0] ?? [0, 1];
      // Three of each thing, so the shelf looks full.
      const material = new THREE.SpriteMaterial({ map: pictureTexture(choice.pictogram) });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(0.9);
      const home = new THREE.Vector3(x, y + 0.45, SHELF_Z + 0.25);
      sprite.position.copy(home);
      this.group.add(sprite);
      for (const dx of [-0.95, 0.95]) {
        const extra = new THREE.Sprite(material);
        extra.scale.setScalar(0.75);
        extra.position.set(x + dx, y + 0.4, SHELF_Z + 0.1);
        sprite.add(extra);
        extra.position.sub(home);
        extra.scale.divideScalar(0.9);
      }
      this.items.set(choice.id, { sprite, home });
    });
  }

  /** The item flies from the shelf into the cart. */
  collect(choiceId: string): void {
    const item = this.items.get(choiceId);
    if (item === undefined) return;
    this.items.delete(choiceId);
    if (this.hinted === choiceId) this.hinted = undefined;
    const slot = this.inCart;
    this.inCart += 1;
    const to = new THREE.Vector3(
      CART.x - 0.3 + (slot % 2) * 0.6,
      1.25 + Math.floor(slot / 2) * 0.35,
      CART.z + 0.1,
    );
    // Only the big one flies; the shelf keeps the others.
    const flying = new THREE.Sprite(item.sprite.material);
    flying.scale.setScalar(0.7);
    flying.position.copy(item.home);
    this.group.add(flying);
    for (const child of item.sprite.children) child.removeFromParent();
    this.group.remove(item.sprite);
    this.flights.push({ sprite: flying, from: item.home.clone(), to, age: 0 });
  }

  /** The item asked for bobs gently on its shelf. */
  hint(choiceId: string | undefined): void {
    if (this.hinted !== undefined) {
      const previous = this.items.get(this.hinted);
      previous?.sprite.position.copy(previous.home);
    }
    this.hinted = choiceId !== undefined && this.items.has(choiceId) ? choiceId : undefined;
  }

  update(time: number, dt: number): void {
    for (const flight of this.flights) {
      if (flight.age >= FLIGHT_SECONDS) continue;
      flight.age = Math.min(FLIGHT_SECONDS, flight.age + dt);
      const t = flight.age / FLIGHT_SECONDS;
      const eased = t * t * (3 - 2 * t);
      flight.sprite.position.lerpVectors(flight.from, flight.to, eased);
      flight.sprite.position.y += Math.sin(t * Math.PI) * 1.2;
    }
    if (this.hinted !== undefined) {
      const item = this.items.get(this.hinted);
      if (item !== undefined) {
        item.sprite.position.copy(item.home);
        item.sprite.position.y += Math.abs(Math.sin(time * 4)) * 0.25;
      }
    }
  }

  private addRoom(): void {
    const { width, depth, height } = ROOM;
    // Checkered floor.
    const tiles = 8;
    const size = width / tiles;
    for (let i = 0; i < tiles; i += 1) {
      for (let j = 0; j < Math.round(depth / size); j += 1) {
        const color = (i + j) % 2 === 0 ? 0xf4efe4 : 0xd9e8de;
        const tile = new THREE.Mesh(new THREE.BoxGeometry(size, 0.1, size), lowPoly(color));
        tile.position.set(-width / 2 + size * (i + 0.5), 0.05, -depth / 2 + size * (j + 0.5));
        tile.receiveShadow = true;
        this.group.add(tile);
      }
    }
    const wall = lowPoly(0x9fdcc0);
    const walls: readonly [number, number, number, number][] = [
      [0, -depth / 2, width, 0.3],
      [-width / 2, 0, 0.3, depth],
      [width / 2, 0, 0.3, depth],
    ];
    for (const [x, z, w, d] of walls) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), wall);
      mesh.position.set(x, height / 2, z);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    // A stripe along the walls, like the facade outside.
    this.group.add(
      solid(new THREE.BoxGeometry(width, 0.35, 0.32), lowPoly(0xe8504c), [
        0,
        3.4,
        -depth / 2 + 0.02,
      ]),
    );
    const sign = createSign(['🍎 MERCADO'], {
      background: '#2f9e6e',
      color: '#ffffff',
      width: 4.4,
      height: 1,
    });
    sign.position.set(0, 4.3, -depth / 2 + 0.2);
    this.group.add(sign);
    // Soft lights so the room is bright on every side.
    for (const x of [-4, 4]) {
      const light = new THREE.PointLight(0xfff6e0, 14, 14, 1.6);
      light.position.set(x, 4.5, 0);
      this.group.add(light);
    }
  }

  private addShelves(): void {
    const wood = lowPoly(0xc98a4b);
    const back = lowPoly(0xf6e3c4);
    for (const x of SHELF_XS) {
      this.group.add(solid(new THREE.BoxGeometry(4, 3, 0.15), back, [x, 1.5, SHELF_Z - 0.35]));
      for (const side of [-1, 1]) {
        this.group.add(
          solid(new THREE.BoxGeometry(0.15, 3, 0.8), wood, [x + side * 2, 1.5, SHELF_Z]),
        );
      }
      for (const y of [0.3, ...SHELF_LEVELS]) {
        this.group.add(solid(new THREE.BoxGeometry(4, 0.1, 0.8), wood, [x, y, SHELF_Z]));
      }
    }
  }

  private addCart(): void {
    const metal = lowPoly(0x9aa0b4, { roughness: 0.4 });
    const red = lowPoly(0xe8504c);
    const cart = new THREE.Group();
    cart.add(solid(new THREE.BoxGeometry(1.5, 0.08, 1), metal, [0, 0.95, 0]));
    for (const [w, d, x, z] of [
      [1.5, 0.06, 0, -0.5],
      [1.5, 0.06, 0, 0.5],
      [0.06, 1, -0.75, 0],
      [0.06, 1, 0.75, 0],
    ] as const) {
      cart.add(solid(new THREE.BoxGeometry(w, 0.6, d), metal, [x, 1.25, z]));
    }
    cart.add(solid(new THREE.BoxGeometry(0.08, 0.08, 1.1), red, [-1, 1.65, 0]));
    for (const z of [-0.5, 0.5]) {
      const bar = solid(new THREE.BoxGeometry(0.4, 0.06, 0.06), metal, [-0.85, 1.55, z]);
      bar.rotation.z = 0.5;
      cart.add(bar);
    }
    for (const [x, z] of [
      [-0.6, -0.4],
      [0.6, -0.4],
      [-0.6, 0.4],
      [0.6, 0.4],
    ] as const) {
      cart.add(solid(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), metal, [x, 0.5, z]));
      const wheel = solid(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), lowPoly(0x2d3142), [
        x,
        0.12,
        z,
      ]);
      wheel.rotation.x = Math.PI / 2;
      cart.add(wheel);
    }
    cart.position.set(CART.x, 0, CART.z);
    this.group.add(cart);
  }

  private addCounter(): void {
    const { x, z } = COUNTER;
    this.group.add(solid(new THREE.BoxGeometry(1.2, 0.8, 3), lowPoly(0x3fae5a), [x, 0.4, z]));
    this.group.add(solid(new THREE.BoxGeometry(1.3, 0.1, 3.1), lowPoly(0xf2efe6), [x, 0.82, z]));
    // Cash register with a small screen.
    this.group.add(
      solid(new THREE.BoxGeometry(0.6, 0.35, 0.6), lowPoly(0x2d3142), [x + 0.1, 1.05, z - 0.8]),
    );
    this.group.add(
      solid(
        new THREE.BoxGeometry(0.5, 0.3, 0.05),
        lowPoly(0x9fe0ff, { emissive: 0x9fe0ff, emissiveIntensity: 0.6 }),
        [x - 0.05, 1.35, z - 0.8],
      ),
    );
    const sign = createSign(['🧾 CAIXA'], {
      background: '#2e86de',
      color: '#ffffff',
      width: 2,
      height: 0.6,
    });
    sign.position.set(x, 2.6, z);
    sign.rotation.y = -Math.PI / 2;
    this.group.add(sign);
  }
}
