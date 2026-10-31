import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ChildLook, HairStyle, OutfitId } from '@domain/avatar/child';

export type Expression = 'calm' | 'happy' | 'sad' | 'angry' | 'scared' | 'surprised' | 'asleep';

/** Children and grown-ups share one body, with different proportions. */
export type Build = 'child' | 'adult';

export type OverLayer = 'none' | 'coat' | 'raincoat';

/** What someone is wearing. Colors are 0xRRGGBB. */
export interface Clothes {
  readonly top: number;
  readonly bottom: number;
  readonly shoes: number;
  readonly longSleeves: boolean;
  readonly longPants: boolean;
  readonly stripes?: boolean;
  readonly barefoot?: boolean;
  readonly badge?: boolean;
  readonly boots?: boolean;
  readonly over?: OverLayer;
  /** Everyday clothes take the colors bought in the wardrobe. */
  readonly takesColors?: boolean;
}

export const outfitClothes: Readonly<Record<OutfitId, Clothes>> = {
  home: {
    top: 0xf2a33a,
    bottom: 0x3f6fb5,
    shoes: 0xf4f1ea,
    longSleeves: false,
    longPants: true,
    takesColors: true,
  },
  pajamas: {
    top: 0x8fb8ec,
    bottom: 0x8fb8ec,
    shoes: 0xf6c9d6,
    longSleeves: true,
    longPants: true,
    stripes: true,
  },
  school: {
    top: 0xfafafa,
    bottom: 0x2f4a7a,
    shoes: 0x33333d,
    longSleeves: false,
    longPants: true,
    badge: true,
  },
  coat: {
    top: 0xc4513c,
    bottom: 0x3f4a63,
    shoes: 0x5a4030,
    longSleeves: true,
    longPants: true,
    over: 'coat',
  },
  raincoat: {
    top: 0xffd23f,
    bottom: 0x3f4a63,
    shoes: 0xffd23f,
    longSleeves: true,
    longPants: true,
    boots: true,
    over: 'raincoat',
  },
  summer: {
    top: 0x3cc2a0,
    bottom: 0xf0b84a,
    shoes: 0xf4f1ea,
    longSleeves: false,
    longPants: false,
    takesColors: true,
  },
  swim: {
    top: 0x2bb5d8,
    bottom: 0x1f5fb5,
    shoes: 0xffffff,
    longSleeves: false,
    longPants: false,
    barefoot: true,
  },
};

/** Sizes of the body, in the model's own units. */
interface Body {
  readonly legLength: number;
  readonly armLength: number;
  readonly torsoHeight: number;
  readonly torsoWidth: number;
  readonly headRadius: number;
  readonly hipsHeight: number;
  /** Long limbs need to be a bit thicker, or they look like sticks. */
  readonly limbSize: number;
  /** Feet to top of the head, without hair: the hair never changes how tall someone is. */
  readonly height: number;
}

const bodies: Readonly<Record<Build, Body>> = {
  child: {
    legLength: 0.24,
    armLength: 0.2,
    torsoHeight: 0.44,
    torsoWidth: 0.2,
    headRadius: 0.3,
    hipsHeight: 0.56,
    limbSize: 1,
    height: 1.6,
  },
  adult: {
    legLength: 0.42,
    armLength: 0.34,
    torsoHeight: 0.66,
    torsoWidth: 0.24,
    headRadius: 0.27,
    hipsHeight: 0.92,
    limbSize: 1.3,
    height: 2.13,
  },
};

/** The bones of every figure, for the motions below. */
export const FIGURE_JOINTS: readonly string[] = [
  'Hips',
  'Torso',
  'Head',
  ...['L', 'R'].flatMap((side) =>
    ['Arm', 'Forearm', 'Leg', 'Shin'].map((name) => `${name}${side}`),
  ),
];

const material = (color: number): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0 });

function joint(name: string, parent: THREE.Object3D, x: number, y: number, z = 0): THREE.Bone {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.position.set(x, y, z);
  parent.add(bone);
  return bone;
}

function part(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

const limb = (radius: number, length: number): THREE.BufferGeometry =>
  new THREE.CapsuleGeometry(radius, length, 3, 8);

const INK = '#3a2a22';

/** Eyes, with what each feeling does to their shape. */
function drawEyes(
  context: CanvasRenderingContext2D,
  look: ChildLook,
  expression: Expression,
  lashes: boolean,
): void {
  const iris = `#${look.eyes.toString(16).padStart(6, '0')}`;
  const wide = expression === 'surprised' || expression === 'scared';
  const y = 118;
  for (const side of [-1, 1]) {
    const x = 128 + side * 50;
    context.strokeStyle = INK;
    context.lineCap = 'round';
    if (expression === 'asleep') {
      context.lineWidth = 8;
      context.beginPath();
      context.arc(x, y - 6, 22, 0.15 * Math.PI, 0.85 * Math.PI);
      context.stroke();
      continue;
    }
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.ellipse(x, y, wide ? 27 : 22, wide ? 33 : 25, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = iris;
    context.beginPath();
    context.ellipse(x, y + 2, wide ? 13 : 16, wide ? 15 : 19, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(x + 6, y - 7, 6, 0, Math.PI * 2);
    context.fill();
    if (expression === 'happy') {
      // Cheeks push the lower lid up in a real smile.
      context.globalCompositeOperation = 'destination-out';
      context.beginPath();
      context.ellipse(x, y + 32, 28, 18, 0, 0, Math.PI * 2);
      context.fill();
      context.globalCompositeOperation = 'source-over';
    }
    if (lashes) {
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(x + side * 21, y - 12);
      context.lineTo(x + side * 31, y - 19);
      context.moveTo(x + side * 14, y - 20);
      context.lineTo(x + side * 20, y - 29);
      context.stroke();
    }
  }
}

/** Brows carry most of a feeling. `inner` and `outer` are heights over the eye. */
function drawBrows(context: CanvasRenderingContext2D, expression: Expression): void {
  const shapes: Readonly<Record<Expression, readonly [number, number]>> = {
    calm: [40, 40],
    happy: [44, 42],
    sad: [52, 32],
    angry: [26, 46],
    scared: [60, 44],
    surprised: [58, 58],
    asleep: [36, 36],
  };
  const [inner, outer] = shapes[expression];
  context.strokeStyle = INK;
  context.lineWidth = 9;
  context.lineCap = 'round';
  for (const side of [-1, 1]) {
    const x = 128 + side * 50;
    context.beginPath();
    context.moveTo(x - side * 24, 118 - inner);
    context.lineTo(x + side * 24, 118 - outer);
    context.stroke();
  }
}

function drawMouth(context: CanvasRenderingContext2D, expression: Expression): void {
  context.strokeStyle = INK;
  context.fillStyle = '#7c2f2a';
  context.lineWidth = 8;
  context.lineCap = 'round';
  context.beginPath();
  switch (expression) {
    case 'happy':
      context.arc(128, 170, 38, 0.05 * Math.PI, 0.95 * Math.PI);
      context.closePath();
      context.fill();
      break;
    case 'sad':
      context.arc(128, 222, 32, 1.2 * Math.PI, 1.8 * Math.PI);
      context.stroke();
      break;
    case 'angry':
      context.moveTo(100, 200);
      context.quadraticCurveTo(128, 186, 156, 200);
      context.stroke();
      break;
    case 'scared':
      context.ellipse(128, 196, 28, 13, 0, 0, Math.PI * 2);
      context.fill();
      break;
    case 'surprised':
      context.ellipse(128, 196, 18, 24, 0, 0, Math.PI * 2);
      context.fill();
      break;
    case 'calm':
    case 'asleep':
      context.arc(128, 168, 25, 0.2 * Math.PI, 0.8 * Math.PI);
      context.stroke();
      break;
  }
}

const faces = new Map<string, THREE.CanvasTexture>();

/** Each face is drawn once and shared: changing expression costs nothing. */
function faceTexture(look: ChildLook, expression: Expression): THREE.CanvasTexture {
  const lashes = look.gender === 'girl';
  const key = `${look.eyes}/${expression}/${lashes}`;
  const known = faces.get(key);
  if (known !== undefined) return known;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context !== null) {
    drawEyes(context, look, expression, lashes);
    if (expression !== 'asleep') drawBrows(context, expression);
    context.fillStyle = 'rgba(240, 110, 100, 0.28)';
    for (const side of [-1, 1]) {
      context.beginPath();
      context.ellipse(128 + side * 82, 160, 19, 12, 0, 0, Math.PI * 2);
      context.fill();
    }
    drawMouth(context, expression);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  faces.set(key, texture);
  return texture;
}

let stripes: THREE.CanvasTexture | undefined;

/** Pale stripes for pajamas: the color comes from the clothes. */
function stripeTexture(): THREE.CanvasTexture {
  if (stripes !== undefined) return stripes;
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 8, 32);
    context.fillStyle = '#c9d6f2';
    context.fillRect(0, 0, 8, 12);
  }
  stripes = new THREE.CanvasTexture(canvas);
  stripes.colorSpace = THREE.SRGBColorSpace;
  stripes.wrapS = THREE.RepeatWrapping;
  stripes.wrapT = THREE.RepeatWrapping;
  stripes.repeat.set(1, 5);
  return stripes;
}

const puff = (radius: number, x: number, y: number, z: number): THREE.BufferGeometry =>
  new THREE.IcosahedronGeometry(radius, 1).translate(x, y, z);

/** A cap of hair over the top and back of the head; the face stays free. */
const hairCap = (r: number, scale: number): THREE.BufferGeometry => {
  const cap = new THREE.SphereGeometry(r * scale, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.5);
  cap.rotateX(-0.32);
  return cap.toNonIndexed();
};

const fringe = (r: number): THREE.BufferGeometry[] => [
  puff(r * 0.34, -r * 0.5, r * 0.72, r * 0.46),
  puff(r * 0.36, r * 0.1, r * 0.8, r * 0.5),
  puff(r * 0.3, r * 0.6, r * 0.66, r * 0.4),
];

function hairShape(style: HairStyle, r: number): THREE.BufferGeometry {
  switch (style) {
    case 'buzz':
      return hairCap(r, 1.02);
    case 'short':
      return mergeGeometries([hairCap(r, 1.08), ...fringe(r)]);
    case 'curly': {
      const curls = [hairCap(r, 1.1)];
      for (let ring = 0; ring < 3; ring += 1) {
        const count = 7 + ring * 3;
        for (let i = 0; i < count; i += 1) {
          const angle = (i / count) * Math.PI * 2 + ring;
          const height = 0.95 - ring * 0.42;
          const spread = 0.42 + ring * 0.42;
          const x = Math.sin(angle) * r * spread;
          const z = Math.cos(angle) * r * spread - r * 0.14;
          if (z > r * 0.55 && height < 0.5) continue;
          curls.push(puff(r * 0.34, x, r * height, z));
        }
      }
      return mergeGeometries(curls);
    }
    case 'afro': {
      const crown = puff(r * 1.2, 0, r * 0.44, -r * 0.4);
      return mergeGeometries([hairCap(r, 1.1), crown]);
    }
    case 'long': {
      const back = new THREE.CapsuleGeometry(r * 0.82, r * 0.7, 4, 12);
      back.scale(1.08, 1, 0.5);
      back.translate(0, -r * 0.42, -r * 0.62);
      return mergeGeometries([
        hairCap(r, 1.09),
        back.toNonIndexed(),
        puff(r * 0.32, -r * 0.46, r * 0.72, r * 0.5),
        puff(r * 0.32, r * 0.46, r * 0.72, r * 0.5),
      ]);
    }
    case 'pigtails': {
      const pieces = [hairCap(r, 1.08), ...fringe(r)];
      for (const side of [-1, 1]) {
        pieces.push(puff(r * 0.34, side * r * 1.1, r * 0.1, -r * 0.1));
        pieces.push(puff(r * 0.27, side * r * 1.2, -r * 0.3, -r * 0.1));
      }
      return mergeGeometries(pieces);
    }
    case 'braids': {
      const pieces = [hairCap(r, 1.08), ...fringe(r)];
      for (const side of [-1, 1]) {
        for (let knot = 0; knot < 4; knot += 1) {
          const size = r * (0.25 - knot * 0.025);
          pieces.push(puff(size, side * r * 0.72, -r * (0.45 + knot * 0.36), -r * 0.42));
        }
      }
      return mergeGeometries(pieces);
    }
    case 'bun':
      return mergeGeometries([hairCap(r, 1.08), puff(r * 0.42, 0, r * 1.02, -r * 0.42)]);
  }
}

/**
 * A person made of parts, like a toy: no download, everything can change while
 * playing, and the joints are bones, so `Player` moves it as any other avatar.
 */
export class Figure {
  readonly model = new THREE.Group();
  readonly body: Body;
  private readonly top = material(0xffffff);
  private readonly bottom = material(0xffffff);
  private readonly shoes = material(0xffffff);
  private readonly skin: THREE.MeshStandardMaterial;
  private readonly faceSurface: THREE.MeshStandardMaterial;
  private readonly forearms: THREE.Mesh[] = [];
  private readonly shins: THREE.Mesh[] = [];
  private readonly hair: THREE.Mesh;
  private readonly badge: THREE.Mesh;
  private readonly coatTail: THREE.Mesh;
  private readonly scarf: THREE.Mesh;
  private readonly hood: THREE.Mesh;
  private readonly bootTops: THREE.Mesh[] = [];
  private clothes: Clothes = outfitClothes.home;
  private tintTop: number | undefined;
  private tintBottom: number | undefined;

  constructor(
    private readonly look: ChildLook,
    build: Build = 'child',
  ) {
    this.body = bodies[build];
    this.skin = material(look.skin);
    const { model, top, bottom, shoes, skin } = this;
    const { legLength, armLength, torsoHeight, torsoWidth, headRadius, hipsHeight } = this.body;
    const size = this.body.limbSize;

    const hips = joint('Hips', model, 0, hipsHeight);
    const torso = joint('Torso', hips, 0, 0);
    const trunk = part(
      torso,
      new THREE.CapsuleGeometry(torsoWidth, torsoHeight * 0.5, 3, 12),
      top,
      0,
      torsoHeight * 0.45,
    );
    trunk.scale.set(1, 1, 0.76);
    const seat = part(hips, new THREE.SphereGeometry(torsoWidth * 0.97, 12, 8), bottom, 0, 0.02);
    seat.scale.set(1, 0.72, 0.76);

    this.badge = part(
      torso,
      new THREE.CylinderGeometry(torsoWidth * 0.2, torsoWidth * 0.2, 0.02, 14).rotateX(Math.PI / 2),
      material(0x2f4a7a),
      -torsoWidth * 0.45,
      torsoHeight * 0.66,
      torsoWidth * 0.72,
    );
    this.coatTail = part(
      torso,
      new THREE.CylinderGeometry(
        torsoWidth * 0.95,
        torsoWidth * 1.3,
        torsoHeight * 0.5,
        16,
        1,
        true,
      ),
      top,
      0,
      -torsoHeight * 0.1,
    );
    this.coatTail.scale.set(1, 1, 0.82);
    this.scarf = part(
      torso,
      new THREE.TorusGeometry(torsoWidth * 0.62, torsoWidth * 0.26, 8, 16).rotateX(Math.PI / 2),
      material(0xf4f1ea),
      0,
      torsoHeight * 0.9,
    );
    this.scarf.scale.set(1, 1, 0.86);

    const head = joint('Head', torso, 0, torsoHeight + 0.03);
    part(head, new THREE.SphereGeometry(headRadius, 18, 12), skin, 0, headRadius * 0.9).scale.set(
      1.04,
      0.96,
      0.98,
    );
    this.hair = part(
      head,
      hairShape(look.hairStyle, headRadius),
      material(look.hair),
      0,
      headRadius * 0.9,
    );
    this.hood = part(
      head,
      new THREE.SphereGeometry(headRadius * 1.14, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
      top,
      0,
      headRadius * 0.9,
      -headRadius * 0.1,
    );
    // Tilted back, so the hood frames the face and never covers the eyes.
    this.hood.rotation.x = -0.8;
    for (const side of [-1, 1]) {
      part(
        head,
        new THREE.SphereGeometry(headRadius * 0.2, 8, 6),
        skin,
        side * headRadius * 1.03,
        headRadius * 0.86,
      );
    }
    part(
      head,
      new THREE.SphereGeometry(headRadius * 0.11, 8, 6),
      skin,
      0,
      headRadius * 0.78,
      headRadius,
    );
    this.faceSurface = new THREE.MeshStandardMaterial({
      map: faceTexture(look, 'calm'),
      transparent: true,
      depthWrite: false,
    });
    const face = new THREE.Mesh(
      new THREE.SphereGeometry(
        headRadius * 1.012,
        14,
        10,
        Math.PI * 0.2,
        Math.PI * 0.6,
        Math.PI * 0.2,
        Math.PI * 0.6,
      ),
      this.faceSurface,
    );
    face.position.y = headRadius * 0.9;
    face.scale.set(1.04, 0.96, 0.98);
    head.add(face);

    for (const [name, side] of [
      ['L', 1],
      ['R', -1],
    ] as const) {
      const shoulder = joint(`Arm${name}`, torso, side * (torsoWidth + 0.05), torsoHeight - 0.06);
      part(shoulder, limb(0.062 * size, armLength * 0.7), top, 0, -armLength * 0.5);
      const elbow = joint(`Forearm${name}`, shoulder, 0, -armLength);
      this.forearms.push(
        part(elbow, limb(0.052 * size, armLength * 0.7), skin, 0, -armLength * 0.5),
      );
      part(elbow, new THREE.SphereGeometry(0.07 * size, 8, 6), skin, 0, -armLength * 1.08);

      const leg = joint(`Leg${name}`, hips, side * 0.1, -0.02);
      part(leg, limb(0.08 * size, legLength * 0.7), bottom, 0, -legLength * 0.5);
      const knee = joint(`Shin${name}`, leg, 0, -legLength);
      this.shins.push(part(knee, limb(0.066 * size, legLength * 0.66), skin, 0, -legLength * 0.5));
      const foot = part(
        knee,
        new THREE.SphereGeometry(0.09 * size, 10, 7),
        shoes,
        0,
        -legLength - 0.02,
        0.04,
      );
      foot.scale.set(0.95, 0.62, 1.5);
      const bootTop = part(
        knee,
        new THREE.CylinderGeometry(0.085 * size, 0.085 * size, legLength * 0.6, 12),
        shoes,
        0,
        -legLength * 0.72,
      );
      this.bootTops.push(bootTop);
    }
    this.wear(outfitClothes.home);
  }

  /** Changes clothes on the same body: nothing is loaded and nothing is rebuilt. */
  wear(clothes: Clothes): void {
    this.clothes = clothes;
    const { longSleeves, longPants, over = 'none' } = clothes;
    const layered = over !== 'none';
    const tinted = clothes.takesColors === true;
    this.top.color.setHex((tinted ? this.tintTop : undefined) ?? clothes.top);
    this.bottom.color.setHex((tinted ? this.tintBottom : undefined) ?? clothes.bottom);
    this.shoes.color.setHex(clothes.barefoot === true ? this.look.skin : clothes.shoes);
    const map = clothes.stripes === true ? stripeTexture() : null;
    if (this.top.map !== map) {
      this.top.map = map;
      this.bottom.map = map;
      this.top.needsUpdate = true;
      this.bottom.needsUpdate = true;
    }
    for (const mesh of this.forearms) mesh.material = longSleeves ? this.top : this.skin;
    for (const mesh of this.shins) mesh.material = longPants ? this.bottom : this.skin;
    for (const mesh of this.bootTops) mesh.visible = clothes.boots === true;
    this.badge.visible = clothes.badge === true;
    this.coatTail.visible = layered;
    this.scarf.visible = over === 'coat';
    this.hood.visible = over === 'raincoat';
    this.hair.visible = over !== 'raincoat';
  }

  /** Colors from the wardrobe, kept for when everyday clothes are on. */
  tint(top: number | undefined, bottom: number | undefined): void {
    this.tintTop = top;
    this.tintBottom = bottom;
    this.wear(this.clothes);
  }

  feel(expression: Expression): void {
    this.faceSurface.map = faceTexture(this.look, expression);
  }
}

/** Rotations of each joint in degrees: one row per moment of the clip. */
type Row = readonly [number, number, number];
type Pose = Readonly<Record<string, readonly Row[]>>;

const DEGREES = Math.PI / 180;

function clip(
  name: string,
  duration: number,
  pose: Pose,
  hipsHeight: number,
  bob?: readonly number[],
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = Object.entries(pose).map(([bone, rows]) => {
    const times = rows.map((_, index) => (index / (rows.length - 1)) * duration);
    const values = rows.flatMap(([x, y, z]) =>
      new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(x * DEGREES, y * DEGREES, z * DEGREES))
        .toArray(),
    );
    return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values);
  });
  if (bob !== undefined) {
    const times = bob.map((_, index) => (index / (bob.length - 1)) * duration);
    const values = bob.flatMap((y) => [0, hipsHeight + y, 0]);
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, values));
  }
  return new THREE.AnimationClip(name, duration, tracks);
}

const swing = (amount: number, sign: 1 | -1): Row[] => [
  [sign * amount, 0, 0],
  [0, 0, 0],
  [-sign * amount, 0, 0],
  [0, 0, 0],
  [sign * amount, 0, 0],
];

const bend = (amount: number, first: boolean): Row[] =>
  first
    ? [
        [amount * 0.2, 0, 0],
        [amount, 0, 0],
        [amount * 0.2, 0, 0],
        [amount * 0.1, 0, 0],
        [amount * 0.2, 0, 0],
      ]
    : [
        [amount * 0.2, 0, 0],
        [amount * 0.1, 0, 0],
        [amount * 0.2, 0, 0],
        [amount, 0, 0],
        [amount * 0.2, 0, 0],
      ];

const armDownL: Row = [0, 0, 7];
const armDownR: Row = [0, 0, -7];
const rest: Row = [0, 0, 0];
const still = (row: Row): Row[] => [row, row];
const arms = { ArmL: still(armDownL), ArmR: still(armDownR) };

/** There and back: a motion that goes to one pose, rests on it and returns. */
const toAndBack = (from: Row, to: Row): Row[] => [from, to, to, to, from];

/** Motions that say what the child is doing in daily life, without a word. */
function dailyClips(hips: number): THREE.AnimationClip[] {
  const shared = (name: string, duration: number, pose: Pose, bob?: readonly number[]) =>
    clip(name, duration, pose, hips, bob);
  // The arm brought up to the mouth, then lowered and raised again.
  const toMouth = (arm: Row, elbow: Row): Pose => ({
    ArmL: still(armDownL),
    ArmR: [armDownR, arm, [arm[0] + 22, arm[1], arm[2]], arm, armDownR],
    ForearmR: [rest, elbow, [elbow[0] + 26, 0, 0], elbow, rest],
  });
  const sitting: Pose = {
    LegL: still([-88, 0, 0]),
    LegR: still([-88, 0, 0]),
    ShinL: still([88, 0, 0]),
    ShinR: still([88, 0, 0]),
    ArmL: still([-16, 0, 7]),
    ArmR: still([-16, 0, -7]),
    ForearmL: still([-26, 0, 0]),
    ForearmR: still([-26, 0, 0]),
  };
  return [
    shared('sit', 0.6, sitting, [-0.24, -0.24]),
    shared('sit-eat', 1.5, { ...sitting, ...toMouth([-108, 0, 30], [-72, 0, 0]) }, [-0.24, -0.24]),
    shared(
      'stand',
      0.6,
      {
        LegL: [[-88, 0, 0], rest],
        LegR: [[-88, 0, 0], rest],
        ShinL: [[88, 0, 0], rest],
        ShinR: [[88, 0, 0], rest],
        Torso: [[24, 0, 0], rest],
      },
      [-0.24, 0],
    ),
    shared(
      'lie',
      0.8,
      {
        Hips: still([-90, 0, 0]),
        ArmL: still([0, 0, 18]),
        ArmR: still([0, 0, -18]),
        Head: still([12, 0, 0]),
      },
      [-0.34, -0.34],
    ),
    shared('eat', 1.5, toMouth([-108, 0, 30], [-72, 0, 0])),
    shared('drink', 1.6, {
      ...toMouth([-112, 0, 30], [-68, 0, 0]),
      Head: toAndBack(rest, [-20, 0, 0]),
    }),
    shared('brush', 1.3, {
      ArmL: still(armDownL),
      ArmR: [armDownR, [-108, 0, 30], [-108, 0, 24], [-108, 0, 30], [-108, 0, 24], armDownR],
      ForearmR: [rest, [-72, 22, 0], [-72, -22, 0], [-72, 22, 0], [-72, -22, 0], rest],
    }),
    shared('wash', 1.3, {
      ArmL: toAndBack(armDownL, [-46, 0, -6]),
      ArmR: toAndBack(armDownR, [-46, 0, 6]),
      ForearmL: [rest, [-44, 20, 0], [-58, -20, 0], [-44, 20, 0], rest],
      ForearmR: [rest, [-58, -20, 0], [-44, 20, 0], [-58, -20, 0], rest],
      Head: toAndBack(rest, [14, 0, 0]),
    }),
    shared(
      'pick',
      1,
      {
        Torso: toAndBack(rest, [38, 0, 0]),
        LegL: toAndBack(rest, [-52, 0, 0]),
        LegR: toAndBack(rest, [-52, 0, 0]),
        ShinL: toAndBack(rest, [76, 0, 0]),
        ShinR: toAndBack(rest, [76, 0, 0]),
        ArmL: toAndBack(armDownL, [-58, 0, 7]),
        ArmR: toAndBack(armDownR, [-58, 0, -7]),
      },
      [0, -0.14, -0.14, -0.14, 0],
    ),
    shared('carry', 0.6, {
      ArmL: still([-52, 0, -6]),
      ArmR: still([-52, 0, 6]),
      ForearmL: still([-52, 0, 0]),
      ForearmR: still([-52, 0, 0]),
    }),
    shared('throw', 1, {
      ArmL: [armDownL, [-40, 0, 7], [-40, 0, 7], armDownL],
      ArmR: [armDownR, [-168, 0, -10], [-60, 0, -8], armDownR],
      ForearmR: [rest, [-70, 0, 0], [-6, 0, 0], rest],
      Torso: [rest, [-10, 22, 0], [14, -18, 0], rest],
    }),
    shared('kick', 0.9, {
      ...arms,
      LegR: [rest, [28, 0, 0], [-74, 0, 0], rest],
      ShinR: [rest, [60, 0, 0], [6, 0, 0], rest],
      Torso: [rest, [-4, 0, 0], [-10, 0, 0], rest],
    }),
    shared(
      'swim',
      1.2,
      {
        Hips: still([-74, 0, 0]),
        Head: still([-52, 0, 0]),
        ArmL: [
          [-180, 0, 10],
          [-90, 0, 40],
          [0, 0, 20],
          [-180, 0, 10],
        ],
        ArmR: [
          [0, 0, -20],
          [-180, 0, -10],
          [-90, 0, -40],
          [0, 0, -20],
        ],
        LegL: swing(14, 1),
        LegR: swing(14, -1),
      },
      [-0.2, -0.17, -0.2, -0.17, -0.2],
    ),
  ];
}

/** Every motion of a figure, with the same names the other avatars use. */
export function figureClips(build: Build = 'child'): THREE.AnimationClip[] {
  const { hipsHeight: hips } = bodies[build];
  const stride = (amount: number, armAmount: number, lean: number): Pose => ({
    Torso: still([lean, 0, 0]),
    LegL: swing(amount, 1),
    LegR: swing(amount, -1),
    ShinL: bend(amount * 1.1, true),
    ShinR: bend(amount * 1.1, false),
    ArmL: swing(armAmount, -1).map(([x]) => [x, 0, 7] as const),
    ArmR: swing(armAmount, 1).map(([x]) => [x, 0, -7] as const),
    ForearmL: still([-25, 0, 0]),
    ForearmR: still([-25, 0, 0]),
  });
  return [
    clip(
      'idle',
      2.6,
      {
        ...arms,
        Torso: [rest, [2, 0, 0], rest],
        Head: [
          [0, -3, 0],
          [2, 3, 0],
          [0, -3, 0],
        ],
      },
      hips,
      [0, -0.006, 0],
    ),
    clip('walk', 0.72, stride(30, 28, 3), hips, [0, 0.016, 0, 0.016, 0]),
    clip('run', 0.46, stride(52, 55, 10), hips, [0, 0.03, 0, 0.03, 0]),
    clip(
      'jump',
      0.5,
      {
        ArmL: still([-150, 0, 16]),
        ArmR: still([-150, 0, -16]),
        LegL: still([-40, 0, 0]),
        LegR: still([-20, 0, 0]),
        ShinL: still([60, 0, 0]),
        ShinR: still([40, 0, 0]),
      },
      hips,
    ),
    clip(
      'wave',
      1.5,
      {
        ArmL: still(armDownL),
        ArmR: [
          armDownR,
          [0, 0, -155],
          [0, 0, -125],
          [0, 0, -155],
          [0, 0, -125],
          [0, 0, -155],
          armDownR,
        ],
        ForearmR: [rest, [0, 0, -18], [0, 0, 18], [0, 0, -18], [0, 0, 18], [0, 0, -18], rest],
        Head: [rest, [0, 0, -6], rest],
      },
      hips,
    ),
    clip(
      'yes',
      1,
      {
        ...arms,
        Head: [rest, [16, 0, 0], [-6, 0, 0], [16, 0, 0], rest],
      },
      hips,
    ),
    clip(
      'thumbs',
      1.2,
      {
        ArmL: still(armDownL),
        ArmR: [armDownR, [-70, 0, -14], [-70, 0, -14], armDownR],
        ForearmR: [rest, [-50, 0, 0], [-50, 0, 0], rest],
      },
      hips,
    ),
    clip(
      'dance',
      1.6,
      {
        Torso: [rest, [0, 12, 8], rest, [0, -12, -8], rest],
        ArmL: [
          [-160, 0, 20],
          [-120, 0, 40],
          [-160, 0, 20],
          [-120, 0, 40],
          [-160, 0, 20],
        ],
        ArmR: [
          [-120, 0, -40],
          [-160, 0, -20],
          [-120, 0, -40],
          [-160, 0, -20],
          [-120, 0, -40],
        ],
        LegL: [rest, [-25, 0, 0], rest, rest, rest],
        LegR: [rest, rest, rest, [-25, 0, 0], rest],
      },
      hips,
      [0, 0.03, 0, 0.03, 0],
    ),
    ...dailyClips(hips),
  ];
}
