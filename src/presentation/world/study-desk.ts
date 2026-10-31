import * as THREE from 'three';
import type { ActivityItem, DeskThing, Picture } from '@domain/activity/activity';
import { lowPoly, solid } from '@presentation/world/materials';

/** All in the house's own coordinates: the desk top and where the board stands. */
const TOP = 0.84;
const DESK = { x: -6.6, z: -0.62 } as const;
const BOARD = { x: -6.6, y: 1.5, z: -0.14, width: 2.3, height: 1.1 } as const;
const SPACING = 0.36;
const HOP_MS = 420;
/** Time to look at what is there, before some of it goes away. */
const LEAVE_AFTER_MS = 1600;
const CHALK = '#f4f1de';
const INK_BOARD = '#2f5d50';
const NOTE_COLORS: Readonly<Record<number, string>> = {
  2: '#5b8fd6',
  5: '#9c7bc4',
  10: '#d9695f',
};

type Build = () => THREE.Object3D;

const sphere = new THREE.SphereGeometry(1, 12, 10);
const stick = new THREE.CylinderGeometry(1, 1, 1, 6);
const plateShape = new THREE.CylinderGeometry(0.5, 0.42, 0.04, 22);
const plateFill = new THREE.CylinderGeometry(0.44, 0.44, 0.04, 22);
const basketShape = new THREE.CylinderGeometry(0.38, 0.28, 0.26, 16, 1, true);
const basketWeave = new THREE.MeshStandardMaterial({ color: 0xc98a4b, side: THREE.DoubleSide });
const clockBody = new THREE.CylinderGeometry(0.5, 0.5, 0.08, 32).rotateX(Math.PI / 2);
const clockFace = new THREE.CircleGeometry(0.46, 32);
const noteShape = new THREE.PlaneGeometry(0.66, 0.33);
const realCoin = new THREE.CircleGeometry(0.2, 24);
const carBody = new THREE.BoxGeometry(0.3, 0.08, 0.16);
const carTop = new THREE.BoxGeometry(0.16, 0.07, 0.14);
const coinShape = new THREE.CylinderGeometry(0.13, 0.13, 0.03, 18);
const fishTail = new THREE.ConeGeometry(0.08, 0.13, 6);

function apple(): THREE.Object3D {
  const group = new THREE.Group();
  const body = solid(sphere, lowPoly(0xd8342f), [0, 0.15, 0]);
  body.scale.set(0.15, 0.14, 0.15);
  const stem = solid(stick, lowPoly(0x6b4427), [0, 0.32, 0]);
  stem.scale.set(0.012, 0.09, 0.012);
  const leaf = solid(sphere, lowPoly(0x4f9d4a), [0.05, 0.33, 0]);
  leaf.scale.set(0.06, 0.018, 0.03);
  group.add(body, stem, leaf);
  return group;
}

function starShape(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? 0.17 : 0.075;
    const angle = (point / 10) * Math.PI * 2 + Math.PI / 2;
    const [x, y] = [Math.cos(angle) * radius, Math.sin(angle) * radius];
    if (point === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
}

const starGeometry = starShape();

const star = (): THREE.Object3D =>
  solid(
    starGeometry,
    lowPoly(0xffc93c, { emissive: 0xffb300, emissiveIntensity: 0.2 }),
    [0, 0.17, 0],
  );

function fish(): THREE.Object3D {
  const group = new THREE.Group();
  const body = solid(sphere, lowPoly(0xf08a3c), [0, 0.13, 0]);
  body.scale.set(0.17, 0.1, 0.07);
  const tail = solid(fishTail, lowPoly(0xd86f27), [0.2, 0.13, 0]);
  tail.rotation.z = Math.PI / 2;
  const eye = solid(sphere, lowPoly(0x241a16), [-0.1, 0.16, 0.06]);
  eye.scale.setScalar(0.016);
  group.add(body, tail, eye);
  return group;
}

function flower(): THREE.Object3D {
  const group = new THREE.Group();
  const stem = solid(stick, lowPoly(0x4f9d4a), [0, 0.12, 0]);
  stem.scale.set(0.012, 0.24, 0.012);
  group.add(stem);
  for (let petal = 0; petal < 5; petal += 1) {
    const angle = (petal / 5) * Math.PI * 2;
    const mesh = solid(sphere, lowPoly(0xf08fb5), [
      Math.cos(angle) * 0.08,
      0.27 + Math.sin(angle) * 0.08,
      0,
    ]);
    mesh.scale.set(0.06, 0.06, 0.03);
    group.add(mesh);
  }
  const center = solid(sphere, lowPoly(0xffd24a), [0, 0.27, 0.015]);
  center.scale.set(0.05, 0.05, 0.03);
  group.add(center);
  return group;
}

function car(): THREE.Object3D {
  const group = new THREE.Group();
  group.add(
    solid(carBody, lowPoly(0x3f7fd6), [0, 0.08, 0]),
    solid(carTop, lowPoly(0xbfe3f5), [0, 0.15, 0]),
  );
  for (const [x, z] of [
    [-0.09, 0.08],
    [0.09, 0.08],
    [-0.09, -0.08],
    [0.09, -0.08],
  ] as const) {
    const wheel = solid(stick, lowPoly(0x2a2a2a), [x, 0.04, z]);
    wheel.scale.set(0.04, 0.03, 0.04);
    wheel.rotation.x = Math.PI / 2;
    group.add(wheel);
  }
  return group;
}

function balloon(): THREE.Object3D {
  const group = new THREE.Group();
  const body = solid(sphere, lowPoly(0xe8504c), [0, 0.33, 0]);
  body.scale.set(0.13, 0.16, 0.13);
  const string = solid(stick, lowPoly(0xeeeeee), [0, 0.09, 0]);
  string.scale.set(0.004, 0.18, 0.004);
  group.add(body, string);
  return group;
}

function coin(): THREE.Object3D {
  const mesh = solid(
    coinShape,
    lowPoly(0xffc93c, { emissive: 0xffb300, emissiveIntensity: 0.2, roughness: 0.35 }),
    [0, 0.14, 0],
  );
  mesh.rotation.x = Math.PI / 2 - 0.5;
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

const builders: Readonly<Record<DeskThing, Build>> = {
  apple,
  star,
  fish,
  flower,
  car,
  balloon,
  coin,
};

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('No 2D canvas');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { context, texture };
}

const FONT = '"Nunito", "Arial Rounded MT Bold", system-ui, sans-serif';

/** A thing the desk has no model for stands there as its picture. */
export function pictureOf(card: Picture): THREE.Object3D {
  const { context, texture } = canvasOf(128, 128);
  context.font = `100px ${FONT}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(card.pictogram, 64, 72);
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.setScalar(0.34);
  sprite.position.y = 0.17;
  const group = new THREE.Group();
  group.add(sprite);
  return group;
}

const thingOf = (card: Picture): THREE.Object3D =>
  card.thing === undefined ? pictureOf(card) : builders[card.thing]();

interface Piece {
  readonly object: THREE.Object3D;
  readonly home: THREE.Vector3;
  hopAt: number | undefined;
}

/**
 * What the study is about, in the room: real things on the desk and a board
 * with what has to be read. Nothing here depends on the answers panel, which
 * keeps a text version for screen readers.
 */
export class StudyDesk {
  readonly group = new THREE.Group();
  /** Follows the comfort setting: things appear in place instead of hopping. */
  calm = false;
  private readonly things = new THREE.Group();
  private readonly board = canvasOf(640, 306);
  private readonly textures: THREE.Texture[] = [];
  private pieces: Piece[] = [];
  private leaving: { readonly pieces: readonly Piece[]; readonly at: number } | undefined;
  private gone: readonly Piece[] = [];
  private carried: Piece[] = [];
  private basket = new THREE.Vector3();
  private clock = 0;
  private asked = 0;

  /** `clutter` is what is usually on the desk, put aside while studying. */
  constructor(private readonly clutter: THREE.Object3D) {
    const { texture } = this.board;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD.width, BOARD.height),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    face.position.set(BOARD.x, BOARD.y, BOARD.z);
    // Toward the child, who sits with their back to the bed.
    face.rotation.y = Math.PI;
    this.group.add(
      solid(
        new THREE.BoxGeometry(BOARD.width + 0.14, BOARD.height + 0.14, 0.05),
        lowPoly(0xb9783f),
        [BOARD.x, BOARD.y, BOARD.z + 0.04],
      ),
      face,
      this.things,
    );
    this.group.visible = false;
  }

  /** From the desk's coordinates to the world's, wherever this desk stands. */
  toWorld(x: number, y: number, z: number): THREE.Vector3 {
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(new THREE.Vector3(x, y, z));
  }

  /** Camera position and what it looks at, leaving room for the answers. */
  view(wide: boolean): readonly [readonly number[], readonly number[]] {
    return wide
      ? [
          [-6.6, 2.5, -3.7],
          [-7.3, 0.95, -0.3],
        ]
      : [
          [-6.6, 3.4, -4.6],
          [-6.6, -0.75, -0.3],
        ];
  }

  show(item: ActivityItem): void {
    this.group.visible = true;
    this.clutter.visible = false;
    this.clear();
    this.asked += 1;
    this.paintBoard(item);
    const { stimulus, interaction } = item;
    switch (stimulus.kind) {
      case 'objects':
        this.rows(stimulus.picture, stimulus.groups);
        break;
      case 'sum':
      case 'compare':
        // The child looks the other way along x: the first plate is on their left.
        this.plate(0x3f7fd6, DESK.x + 0.6, stimulus.picture, stimulus.a);
        this.plate(0xe8504c, DESK.x - 0.6, stimulus.picture, stimulus.b);
        break;
      case 'minus':
        this.rows(stimulus.picture, stimulus.a > 5 ? [5, stimulus.a - 5] : [stimulus.a]);
        this.leaving = { pieces: this.pieces.slice(-stimulus.b), at: this.clock + LEAVE_AFTER_MS };
        break;
      case 'clock':
        this.addClock(stimulus.hour);
        break;
      case 'cash':
        this.addCash(stimulus.values);
        break;
      default:
        break;
    }
    if (interaction.kind === 'drag') this.addCarrying(interaction.piece, interaction.supply);
  }

  /** The drag on the panel happens here too: what is carried lands in the basket. */
  carry(count: number): void {
    this.carried.forEach((piece, index) => {
      const row = Math.floor(index / 5);
      const inBasket = index < count;
      const target = inBasket
        ? this.basket.clone().add(new THREE.Vector3((index % 5) * 0.1 - 0.2, 0.1 + row * 0.1, 0))
        : piece.home;
      this.place(piece, target);
    });
  }

  /** The things hop one by one, as they are counted. */
  countAlong(): void {
    if (this.calm) return;
    this.pieces.forEach((piece, index) => {
      piece.hopAt = this.clock + index * HOP_MS;
    });
  }

  hide(): void {
    this.group.visible = false;
    this.clutter.visible = true;
    this.clear();
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.clock += dt * 1000;
    const { leaving } = this;
    if (leaving !== undefined && this.clock >= leaving.at) {
      this.leaving = undefined;
      this.gone = leaving.pieces;
      if (this.calm) this.removeGone();
    }
    for (const { object } of this.gone) {
      object.position.y += dt * 1.1;
      object.scale.multiplyScalar(Math.max(0, 1 - dt * 2.4));
    }
    for (const piece of this.pieces) {
      if (!this.gone.includes(piece)) this.settle(piece, dt);
    }
  }

  private removeGone(): void {
    for (const { object } of this.gone) object.removeFromParent();
    this.gone = [];
  }

  private settle(piece: Piece, dt: number): void {
    const { object, home, hopAt } = piece;
    object.position.lerp(home, Math.min(1, dt * 12));
    if (hopAt === undefined || this.clock < hopAt) return;
    const progress = (this.clock - hopAt) / HOP_MS;
    if (progress >= 1) piece.hopAt = undefined;
    else object.position.y = home.y + Math.sin(progress * Math.PI) * 0.16;
  }

  private place(piece: Piece, target: THREE.Vector3): void {
    piece.home.copy(target);
    if (this.calm) piece.object.position.copy(target);
  }

  private clear(): void {
    this.things.clear();
    for (const texture of this.textures.splice(0)) texture.dispose();
    this.pieces = [];
    this.carried = [];
    this.leaving = undefined;
    this.gone = [];
  }

  private put(card: Picture, x: number, z: number, y = TOP): Piece {
    const object = thingOf(card);
    const home = new THREE.Vector3(x, y, z);
    object.position.copy(home);
    this.things.add(object);
    const piece: Piece = { object, home, hopAt: undefined };
    this.pieces.push(piece);
    return piece;
  }

  private rows(card: Picture, groups: readonly number[]): void {
    groups.forEach((count, row) => {
      const z = DESK.z + (groups.length > 1 ? (row === 0 ? 0.17 : -0.17) : 0);
      for (let index = 0; index < count; index += 1) {
        this.put(card, DESK.x + (index - (count - 1) / 2) * SPACING, z);
      }
    });
  }

  private plate(color: number, x: number, card: Picture, count: number): void {
    // White inside: a red apple must not vanish on the red plate.
    this.things.add(
      solid(plateShape, lowPoly(color), [x, TOP + 0.02, DESK.z]),
      solid(plateFill, lowPoly(0xfff8ec), [x, TOP + 0.03, DESK.z]),
    );
    for (let index = 0; index < count; index += 1) {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const rows = Math.ceil(count / 3);
      const inRow = Math.min(3, count - row * 3);
      this.put(
        card,
        x + (column - (inRow - 1) / 2) * 0.28,
        DESK.z + (row - (rows - 1) / 2) * 0.28,
        TOP + 0.04,
      );
    }
  }

  private addCarrying(card: Picture, supply: number): void {
    this.basket.set(DESK.x + 0.72, TOP, DESK.z);
    const basket = solid(basketShape, basketWeave, [this.basket.x, TOP + 0.13, this.basket.z]);
    this.things.add(basket);
    for (let index = 0; index < supply; index += 1) {
      const row = Math.floor(index / 4);
      this.carried.push(
        this.put(card, DESK.x - 0.95 + (index % 4) * 0.28, DESK.z - 0.14 + row * 0.26),
      );
    }
  }

  private addClock(hour: number): void {
    const { context, texture } = canvasOf(320, 320);
    context.fillStyle = '#fffaf0';
    context.beginPath();
    context.arc(160, 160, 156, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2a2a2a';
    context.font = `800 40px ${FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let mark = 1; mark <= 12; mark += 1) {
      const angle = (mark / 12) * Math.PI * 2 - Math.PI / 2;
      context.fillText(String(mark), 160 + Math.cos(angle) * 122, 162 + Math.sin(angle) * 122);
    }
    const hand = (turn: number, length: number, width: number, color: string) => {
      const angle = turn * Math.PI * 2 - Math.PI / 2;
      context.strokeStyle = color;
      context.lineWidth = width;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(160, 160);
      context.lineTo(160 + Math.cos(angle) * length, 160 + Math.sin(angle) * length);
      context.stroke();
    };
    hand(0, 100, 8, '#3f7fd6');
    hand(hour / 12, 62, 14, '#e8504c');
    texture.needsUpdate = true;
    this.textures.push(texture);
    const face = new THREE.Mesh(clockFace, new THREE.MeshBasicMaterial({ map: texture }));
    const clock = new THREE.Group();
    clock.add(solid(clockBody, lowPoly(0xe8504c)), face);
    face.position.z = -0.05;
    face.rotation.y = Math.PI;
    clock.position.set(DESK.x, TOP + 0.48, DESK.z);
    clock.rotation.x = 0.28;
    this.things.add(clock);
  }

  private addCash(values: readonly number[]): void {
    values.forEach((value, index) => {
      const x = DESK.x + (index - (values.length - 1) / 2) * 0.72;
      // One real is a coin; the others are notes, each with its color.
      const isCoin = value === 1;
      const { context, texture } = isCoin ? canvasOf(128, 128) : canvasOf(256, 128);
      const { width } = context.canvas;
      context.fillStyle = NOTE_COLORS[value] ?? '#e0b84a';
      context.fillRect(0, 0, width, 128);
      context.fillStyle = '#ffffff';
      context.font = `900 ${isCoin ? 44 : 64}px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(`R$ ${value}`, width / 2, 70);
      texture.needsUpdate = true;
      this.textures.push(texture);
      const note = new THREE.Mesh(
        isCoin ? realCoin : noteShape,
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
      );
      note.position.set(x, TOP + 0.2, DESK.z);
      note.rotation.set(-0.5, Math.PI, 0);
      this.things.add(note);
    });
  }

  private paintBoard({ stimulus }: ActivityItem): void {
    const { context, texture } = this.board;
    const { width, height } = context.canvas;
    context.fillStyle = INK_BOARD;
    context.fillRect(0, 0, width, height);
    context.fillStyle = CHALK;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const write = (text: string, x: number, room: number) => {
      let size = 150;
      context.font = `900 ${size}px ${FONT}`;
      while (context.measureText(text).width > room && size > 40) {
        size -= 10;
        context.font = `900 ${size}px ${FONT}`;
      }
      context.fillText(text, x, height / 2 + 8);
    };
    const asked = this.asked;
    const draw = (card: Picture, x: number) => {
      if (card.image === undefined) {
        context.font = `150px ${FONT}`;
        context.fillText(card.pictogram, x, height / 2 + 8);
        return;
      }
      const image = new Image();
      image.onload = () => {
        if (asked !== this.asked) return;
        context.fillStyle = '#ffffff';
        context.fillRect(x - 120, height / 2 - 120, 240, 240);
        context.drawImage(image, x - 112, height / 2 - 112, 224, 224);
        texture.needsUpdate = true;
      };
      image.src = `${import.meta.env.BASE_URL}${card.image}`;
    };
    switch (stimulus.kind) {
      case 'word':
        if (stimulus.picture === undefined) write(stimulus.text, width / 2, width - 60);
        else {
          draw(stimulus.picture, 150);
          write(stimulus.text, 450, 340);
        }
        break;
      case 'picture':
        draw(stimulus.picture, width / 2);
        break;
      case 'sum':
        write(`${stimulus.a} + ${stimulus.b} = ?`, width / 2, width - 60);
        break;
      case 'price':
        draw(stimulus.picture, 170);
        write(`= ${stimulus.price}`, 440, 300);
        break;
      default:
        break;
    }
    texture.needsUpdate = true;
  }
}
