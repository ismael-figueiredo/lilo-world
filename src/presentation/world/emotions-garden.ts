import * as THREE from 'three';
import { box, circle, type Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import { lowPoly, solid } from '@presentation/world/materials';
import { createPostSign } from '@presentation/world/sign';
import { fitHeight, type WorldAssets } from '@presentation/world/world-assets';

/** A quiet garden in the island's south-west, for the Emotions missions. */
export const EMOTIONS_GARDEN = { x: -60, z: 45, radius: 14, height: 4.6 } as const;

export const EmotionsPlace = {
  faces: 'emotions:faces',
  stories: 'emotions:stories',
  calm: 'emotions:calm',
  back: 'emotions:back',
} as const;

/** Where the child appears when coming through the portal (looking at the garden). */
export const emotionsArrival = new THREE.Vector3(
  EMOTIONS_GARDEN.x,
  EMOTIONS_GARDEN.height,
  EMOTIONS_GARDEN.z + 9,
);

/** The five faces, each with its own soft color. */
const faces: readonly (readonly [string, string])[] = [
  ['😊', '#ffd23f'],
  ['😢', '#5fa8f5'],
  ['😠', '#ff7a6b'],
  ['😨', '#b48cff'],
  ['😮', '#7ed8a8'],
];

/** A round face on a disc, drawn once on a canvas. */
function faceDisc(emoji: string, color: string): THREE.Group {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(128, 128, 128, 0, Math.PI * 2);
    context.fill();
    context.font = '170px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(emoji, 128, 142);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  const rim = solid(
    new THREE.CylinderGeometry(0.95, 0.95, 0.18, 32),
    lowPoly(new THREE.Color(color).getHex()),
  );
  rim.rotation.x = Math.PI / 2;
  group.add(rim);
  const front = new THREE.Mesh(
    new THREE.CircleGeometry(0.88, 32),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.6,
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: 0.25,
    }),
  );
  front.position.z = 0.1;
  group.add(front);
  return group;
}

/** Five big faces in a half circle, a little story stage, the calm corner and the way back. */
export class EmotionsGarden {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly places: Interactable[] = [];
  private readonly discs: THREE.Object3D[] = [];
  private readonly lamp: THREE.MeshStandardMaterial;

  constructor(private readonly assets: WorldAssets) {
    this.group.position.set(EMOTIONS_GARDEN.x, EMOTIONS_GARDEN.height, EMOTIONS_GARDEN.z);
    this.lamp = lowPoly(0xfff3c4, { emissive: 0xffe9a3, emissiveIntensity: 0.6 });
    this.addPaths();
    this.addFaces();
    this.addStage();
    this.addCalmCorner();
    this.addWayBack();
  }

  /** Very slow movement only: faces sway a little, the calm lamp breathes. */
  update(time: number): void {
    this.discs.forEach((disc, index) => {
      disc.rotation.z = Math.sin(time * 0.6 + index) * 0.05;
    });
    this.lamp.emissiveIntensity = 0.45 + Math.sin(time * 0.8) * 0.25;
  }

  private at(x: number, z: number): { x: number; z: number } {
    return { x: EMOTIONS_GARDEN.x + x, z: EMOTIONS_GARDEN.z + z };
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
      position: new THREE.Vector3(spot.x, EMOTIONS_GARDEN.height, spot.z),
      markerPosition: new THREE.Vector3(spot.x, EMOTIONS_GARDEN.height + 3.8, spot.z - 1.5),
      radius: 2.8,
      icon,
      label,
      name,
      viewFrom: 'south',
    });
  }

  private sign(text: string, color: string, x: number, z: number): void {
    const sign = createPostSign(
      [text],
      { background: color, color: '#ffffff', width: 3.2, height: 0.9 },
      1.3,
    );
    sign.position.set(x, 0, z);
    this.group.add(sign);
    const spot = this.at(x, z);
    this.colliders.push(circle(spot.x, spot.z, 0.5));
  }

  private addPaths(): void {
    const stone = lowPoly(0xe8dcc4);
    this.group.add(solid(new THREE.CylinderGeometry(4.5, 4.5, 0.08, 36), stone, [0, 0.04, -3]));
    this.group.add(solid(new THREE.BoxGeometry(2.4, 0.06, 9), stone, [0, 0.03, 3.5]));
    this.group.add(solid(new THREE.BoxGeometry(22, 0.06, 2.2), stone, [0, 0.03, 3]));
    for (const [x, z, model] of [
      [-10, -6, 'bush-flowers'],
      [10, -7, 'flower-group'],
      [-5, 6.5, 'flower-group'],
      [6, 6.5, 'bush-flowers'],
    ] as const) {
      const plant = this.assets.clone(model);
      fitHeight(plant, 1.1);
      plant.position.set(x, 0, z);
      this.group.add(plant);
    }
    this.sign('💛 EMOÇÕES', '#f07a9a', 3, 7.5);
  }

  private addFaces(): void {
    faces.forEach(([emoji, color], index) => {
      const angle = Math.PI * (0.15 + (index / (faces.length - 1)) * 0.7);
      const x = Math.cos(angle) * 3.6;
      const z = -3 - Math.sin(angle) * 3.6;
      this.group.add(
        solid(new THREE.CylinderGeometry(0.1, 0.12, 2.2, 10), lowPoly(0x3d4a5c), [x, 1.1, z]),
      );
      const disc = faceDisc(emoji, color);
      disc.position.set(x, 2.6, z);
      // Every face looks at the middle of the circle, where the child stands.
      disc.rotation.y = Math.atan2(-x, -3 - z);
      this.group.add(disc);
      this.discs.push(disc);
      const spot = this.at(x, z);
      this.colliders.push(circle(spot.x, spot.z, 0.4));
    });
    this.addPlace(EmotionsPlace.faces, 0, -1.2, '😊', 'Rostos', 'Rostos');
  }

  private addStage(): void {
    const x = -8.5;
    const z = -1.5;
    const wood = lowPoly(0xc98a4b);
    const curtain = lowPoly(0xd94c5c, { roughness: 0.9 });
    this.group.add(solid(new THREE.BoxGeometry(4.2, 0.5, 2.6), wood, [x, 0.25, z - 0.5]));
    for (const dx of [-1.95, 1.95]) {
      this.group.add(solid(new THREE.BoxGeometry(0.25, 3, 0.25), wood, [x + dx, 1.5, z - 1.6]));
      this.group.add(
        solid(new THREE.BoxGeometry(0.9, 2.4, 0.15), curtain, [x + dx * 0.78, 1.7, z - 1.45]),
      );
    }
    this.group.add(solid(new THREE.BoxGeometry(4.4, 0.5, 0.3), curtain, [x, 3, z - 1.55]));
    this.group.add(
      solid(new THREE.BoxGeometry(4, 2.4, 0.1), lowPoly(0xfff1d6), [x, 1.7, z - 1.75]),
    );
    // A book standing on the stage: the stories are read here.
    const book = solid(new THREE.BoxGeometry(0.9, 0.7, 0.15), lowPoly(0x3fa9f5), [
      x,
      0.85,
      z - 0.6,
    ]);
    book.rotation.x = -0.25;
    this.group.add(book);
    const spot = this.at(x, z - 0.6);
    this.colliders.push(box(spot.x, spot.z, 4.5, 2.8));
    this.sign('📖 HISTÓRIAS', '#d94c5c', x + 3, z + 1.4);
    this.addPlace(EmotionsPlace.stories, x, z + 2.6, '📖', 'Histórias', 'Histórias');
  }

  private addCalmCorner(): void {
    const x = 8.5;
    const z = -1.5;
    this.group.add(
      solid(new THREE.CylinderGeometry(2.6, 2.6, 0.06, 30), lowPoly(0xb9e3f5), [x, 0.05, z - 0.5]),
    );
    // A soft tent-like canopy, bean bags, cushions and a slowly glowing lamp.
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0xcfe8ff,
        roughness: 1,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      }),
    );
    canopy.position.set(x, 0, z - 1.4);
    canopy.scale.set(1, 1.1, 0.7);
    this.group.add(canopy);
    for (const [dx, dz, color] of [
      [-1, -0.8, 0x9b6bf2],
      [1, -1, 0x3fae5a],
    ] as const) {
      const bag = solid(new THREE.SphereGeometry(0.7, 14, 10), lowPoly(color, { roughness: 1 }), [
        x + dx,
        0.45,
        z + dz,
      ]);
      bag.scale.set(1, 0.65, 1);
      this.group.add(bag);
    }
    for (const [dx, color] of [
      [-0.2, 0xffc93c],
      [0.4, 0xff7a6b],
    ] as const) {
      this.group.add(
        solid(new THREE.BoxGeometry(0.5, 0.18, 0.5), lowPoly(color, { roughness: 1 }), [
          x + dx,
          0.15,
          z + 0.4,
        ]),
      );
    }
    this.group.add(
      solid(new THREE.CylinderGeometry(0.05, 0.08, 1.2, 8), lowPoly(0x3d4a5c), [
        x + 2,
        0.6,
        z - 1.6,
      ]),
    );
    this.group.add(solid(new THREE.SphereGeometry(0.3, 14, 10), this.lamp, [x + 2, 1.35, z - 1.6]));
    const teddy = new THREE.Group();
    const fur = lowPoly(0xc98a4b, { roughness: 1 });
    teddy.add(solid(new THREE.SphereGeometry(0.3, 12, 8), fur, [0, 0.3, 0]));
    teddy.add(solid(new THREE.SphereGeometry(0.22, 12, 8), fur, [0, 0.7, 0]));
    for (const ex of [-0.15, 0.15])
      teddy.add(solid(new THREE.SphereGeometry(0.08, 8, 6), fur, [ex, 0.88, 0]));
    teddy.position.set(x - 1, 0.6, z - 0.8);
    this.group.add(teddy);
    const spot = this.at(x, z - 0.8);
    this.colliders.push(box(spot.x, spot.z, 4.4, 2.6));
    this.sign('🧸 CANTINHO CALMO', '#5fa8f5', x - 2.6, z + 1.6);
    this.addPlace(EmotionsPlace.calm, x, z + 2.6, '🧸', 'Cantinho calmo', 'Cantinho calmo');
  }

  private addWayBack(): void {
    const arch = new THREE.Group();
    const frame = lowPoly(0xf07a9a, { emissive: 0xf07a9a, emissiveIntensity: 0.3 });
    for (const dx of [-1.4, 1.4])
      arch.add(solid(new THREE.BoxGeometry(0.5, 2.4, 0.5), frame, [dx, 1.2, 0]));
    arch.add(solid(new THREE.TorusGeometry(1.4, 0.28, 8, 16, Math.PI), frame, [0, 2.4, 0]));
    arch.position.set(-6, 0, 9);
    this.group.add(arch);
    for (const dx of [-1.4, 1.4]) {
      const spot = this.at(-6 + dx, 9);
      this.colliders.push(circle(spot.x, spot.z, 0.4));
    }
    const spot = this.at(-6, 7.6);
    this.places.push({
      id: EmotionsPlace.back,
      position: new THREE.Vector3(spot.x, EMOTIONS_GARDEN.height, spot.z),
      markerPosition: new THREE.Vector3(spot.x, EMOTIONS_GARDEN.height + 4, spot.z),
      radius: 2.4,
      icon: '🌀',
      label: 'Voltar aos portais',
      name: 'Portal de volta',
    });
  }
}
