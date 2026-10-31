import * as THREE from 'three';
import type { MissionChoice } from '@domain/mission/mission';
import { lowPoly, solid } from '@presentation/world/materials';
import { written } from '@domain/money/money';
import { box, type Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import { ITEM_PLACE, MARKET_INTERIOR, MarketPlace } from '@presentation/world/market-position';
import { createSign } from '@presentation/world/sign';
import type { WalkableSpace } from '@presentation/world/game-world';
import type { Zone } from '@presentation/world/zones/zone';

const ROOM = { width: 16, depth: 11, height: 6 } as const;
const SHELF_Z = -ROOM.depth / 2 + 0.9;
const SHELF_LEVELS = [0.75, 1.55, 2.35] as const;
const SHELF_XS = [-4.6, 0, 4.6] as const;
const COUNTER = { x: 5.6, z: 2.4 } as const;
const CART = { x: 1.4, z: -1.6 } as const;
const FLIGHT_SECONDS = 0.8;
/** The low shelf in the middle of the room: walking around it is the aisle. */
const ISLAND = { x: -1.6, z: 0.6, width: 7.4, depth: 0.9, height: 1.15 } as const;
const REACH = 1.25;
const CART_FOLLOW = 7;
const CART_BEHIND = 1.5;

/** What goes on the shelves for a task: it can be walked to and picked. */
export interface ShelfItem {
  readonly id: string;
  readonly name: string;
  readonly short: string;
  readonly icon: string;
  readonly price: number;
}

/** Where things are, along the back wall and on the low shelf. */
const SHELF_SPOTS: readonly {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly standZ: number;
}[] = [
  ...[-5.6, -3.2, -0.8, 1.6, 4].map((x) => ({
    x,
    y: SHELF_LEVELS[1] + 0.45,
    z: SHELF_Z + 0.25,
    standZ: SHELF_Z + 1.4,
  })),
  ...[-4.2, -1.6, 1].map((x) => ({
    x,
    y: ISLAND.height + 0.35,
    z: ISLAND.z,
    standZ: ISLAND.z + 1.3,
  })),
];

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
export class MarketInterior implements Zone, WalkableSpace {
  readonly group = new THREE.Group();
  readonly colliders: readonly Collider[] = [];
  readonly places: readonly Interactable[] = [];
  private readonly items = new Map<string, Item>();
  private readonly flights: Flight[] = [];
  private inCart = 0;
  private hinted: string | undefined;
  private readonly cart = new THREE.Group();
  private readonly tags = new THREE.Group();
  private readonly doorSpot: THREE.Vector3;
  /** Walking inside: what is solid and what can be used. */
  readonly walkColliders: readonly Collider[];
  walkPlaces: readonly Interactable[] = [];

  constructor(private readonly floor: number) {
    this.group.position.set(MARKET_INTERIOR.x, floor, MARKET_INTERIOR.z);
    this.addRoom();
    this.addShelves();
    this.addCart();
    this.addCounter();
    this.addIsland();
    this.group.add(this.tags);
    this.doorSpot = this.world(0, 0, ROOM.depth / 2 - 0.9);
    const { width, depth } = ROOM;
    const wall = (x: number, z: number, w: number, d: number): Collider =>
      box(MARKET_INTERIOR.x + x, MARKET_INTERIOR.z + z, w, d);
    this.walkColliders = [
      wall(0, SHELF_Z, width, 1.2),
      wall(-width / 2, 0, 0.4, depth),
      wall(width / 2, 0, 0.4, depth),
      wall(ISLAND.x, ISLAND.z, ISLAND.width, ISLAND.depth),
      wall(COUNTER.x, COUNTER.z, 1.3, 3.1),
    ];
  }

  /** Where the room ends: there is no front wall, only the door the child uses. */
  contains(x: number, z: number): boolean {
    return (
      Math.abs(x - MARKET_INTERIOR.x) < ROOM.width / 2 &&
      Math.abs(z - MARKET_INTERIOR.z) < ROOM.depth / 2
    );
  }

  get entrance(): THREE.Vector3 {
    return this.doorSpot;
  }

  get height(): number {
    return this.floor;
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
      lookAt: this.world(COUNTER.x + 0.6, 0.2, COUNTER.z + 2),
    };
  }

  /** Puts today's groceries on the shelves (and empties the cart). */
  stock(choices: readonly MissionChoice[]): void {
    for (const item of this.items.values()) this.group.remove(item.sprite);
    this.items.clear();
    this.flights.length = 0;
    this.tags.clear();
    this.emptyCart();
    this.cart.position.set(CART.x, 0, CART.z);
    this.cart.rotation.y = 0;
    this.walkPlaces = [];
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

  /** The shelves of a task: each thing has its place and its price. */
  stockForErrand(items: readonly ShelfItem[], picked: readonly string[]): void {
    for (const item of this.items.values()) this.group.remove(item.sprite);
    this.items.clear();
    this.flights.length = 0;
    this.tags.clear();
    this.emptyCart();
    const places: Interactable[] = [
      {
        id: MarketPlace.checkout,
        position: this.checkoutSpot,
        markerPosition: this.world(COUNTER.x - 1.7, 3, COUNTER.z),
        radius: 1.6,
        icon: '🧾',
        label: 'Ir ao caixa',
        name: 'Caixa',
      },
      {
        id: MarketPlace.door,
        position: this.doorSpot,
        markerPosition: this.doorSpot.clone().setY(this.floor + 2.6),
        radius: 1.5,
        icon: '🚪',
        label: 'Sair do mercado',
        name: 'Saída',
      },
    ];
    items.forEach((item, index) => {
      const spot = SHELF_SPOTS[index];
      if (spot === undefined) return;
      if (picked.includes(item.id)) {
        this.addToCart(pictureTexture(item.icon));
        return;
      }
      const material = new THREE.SpriteMaterial({ map: pictureTexture(item.icon) });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(0.8);
      const home = new THREE.Vector3(spot.x, spot.y, spot.z);
      sprite.position.copy(home);
      this.group.add(sprite);
      this.items.set(item.id, { sprite, home });
      const tag = createSign([written(item.price)], {
        background: '#fff8e6',
        color: '#2d3142',
        width: 1.3,
        height: 0.5,
      });
      tag.name = item.id;
      tag.position.set(spot.x, spot.y - 0.6, spot.z + 0.46);
      this.tags.add(tag);
      places.push({
        id: `${ITEM_PLACE}${item.id}`,
        position: this.world(spot.x, 0, spot.standZ),
        markerPosition: this.world(spot.x, spot.y + 1, spot.z),
        radius: REACH,
        icon: item.icon,
        label: `Pegar ${item.short}`,
        name: item.short,
      });
    });
    this.walkPlaces = places;
  }

  /** Off the shelf and into the cart that came along. */
  takeFromShelf(id: string): void {
    const item = this.items.get(id);
    if (item === undefined) return;
    this.items.delete(id);
    this.group.remove(item.sprite);
    this.tags.getObjectByName(id)?.removeFromParent();
    this.walkPlaces = this.walkPlaces.filter((place) => place.id !== `${ITEM_PLACE}${id}`);
    const material = item.sprite.material;
    if (material.map !== null) this.addToCart(material.map);
  }

  private addToCart(texture: THREE.Texture): void {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    sprite.scale.setScalar(0.6);
    const slot = this.cart.children.filter((child) => child instanceof THREE.Sprite).length;
    sprite.position.set(-0.35 + (slot % 2) * 0.7, 1.45 + Math.floor(slot / 2) * 0.3, 0);
    this.cart.add(sprite);
  }

  private emptyCart(): void {
    for (const child of [...this.cart.children]) {
      if (child instanceof THREE.Sprite) child.removeFromParent();
    }
    this.inCart = 0;
  }

  /** The cart stays just ahead of the child, as if pushed. */
  followWithCart(position: THREE.Vector3, facing: number, dt: number): void {
    const x = position.x + Math.sin(facing) * CART_BEHIND - MARKET_INTERIOR.x;
    const z = position.z + Math.cos(facing) * CART_BEHIND - MARKET_INTERIOR.z;
    const blend = Math.min(1, dt * CART_FOLLOW);
    this.cart.position.x += (x - this.cart.position.x) * blend;
    this.cart.position.z += (z - this.cart.position.z) * blend;
    const turn = Math.atan2(
      Math.sin(facing - Math.PI / 2 - this.cart.rotation.y),
      Math.cos(facing - Math.PI / 2 - this.cart.rotation.y),
    );
    this.cart.rotation.y += turn * blend;
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
    // The floor goes on past the door, so the room never ends in the sky.
    this.group.add(
      solid(new THREE.BoxGeometry(width + 20, 0.08, 16), lowPoly(0xd9d2c2), [
        0,
        0.02,
        depth / 2 + 8,
      ]),
    );
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
    const { cart } = this;
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

  private addIsland(): void {
    const { x, z, width, depth, height } = ISLAND;
    this.group.add(
      solid(new THREE.BoxGeometry(width, height - 0.1, depth), lowPoly(0xf6e3c4), [
        x,
        (height - 0.1) / 2,
        z,
      ]),
      solid(new THREE.BoxGeometry(width + 0.2, 0.1, depth + 0.2), lowPoly(0xc98a4b), [
        x,
        height,
        z,
      ]),
    );
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
