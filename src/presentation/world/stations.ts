import * as THREE from 'three';
import type { Skill } from '@domain/learning/challenge';
import { circle, type Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import { lowPoly, solid } from '@presentation/world/materials';
import { createPostSign } from '@presentation/world/sign';

export const stationId = (skill: Skill): string => `station:${skill}`;

export const skillOfStation = (placeId: string): Skill | undefined => {
  const skill = placeId.startsWith('station:') ? placeId.slice('station:'.length) : '';
  return skill === 'letters' || skill === 'numbers' || skill === 'coins' ? skill : undefined;
};

export interface StationLook {
  readonly skill: Skill;
  readonly icon: string;
  readonly name: string;
  readonly color: string;
}

export const stationLooks: Readonly<Record<Skill, StationLook>> = {
  letters: { skill: 'letters', icon: '🔤', name: 'Letras', color: '#9b6bf2' },
  numbers: { skill: 'numbers', icon: '🔢', name: 'Números', color: '#ff8a3d' },
  coins: { skill: 'coins', icon: '🪙', name: 'Moedas', color: '#e8b10f' },
};

/** A toy block with a big letter or number on every side. */
function block(text: string, color: string, size: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.fillStyle = color;
    context.fillRect(0, 0, 256, 256);
    context.strokeStyle = 'rgba(255,255,255,0.85)';
    context.lineWidth = 18;
    context.strokeRect(14, 14, 228, 228);
    context.fillStyle = '#ffffff';
    context.font = '900 170px "Nunito", "Arial Rounded MT Bold", system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 140);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.BoxGeometry(size, size, size);
  return solid(geometry, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 }));
}

function lettersProp(): THREE.Group {
  const group = new THREE.Group();
  const blocks: readonly [string, string, number, number, number, number][] = [
    ['A', '#e8504c', -0.75, 0.55, 0, 0.2],
    ['B', '#3fa9f5', 0.75, 0.55, 0.1, -0.15],
    ['C', '#3fae5a', 0, 1.65, 0, 0.35],
  ];
  for (const [text, color, x, y, z, turn] of blocks) {
    const mesh = block(text, color, 1.1);
    mesh.position.set(x, y, z);
    mesh.rotation.y = turn;
    group.add(mesh);
  }
  return group;
}

function numbersProp(): THREE.Group {
  const group = new THREE.Group();
  [1, 2, 3].forEach((value, index) => {
    const mesh = block(String(value), '#c98a4b', 0.95);
    mesh.position.set(-1.1 + index * 1.1, 0.48 + (index === 1 ? 0.95 : 0), 0);
    group.add(mesh);
    if (index === 1) {
      const base = block('🍎', '#c98a4b', 0.95);
      base.position.set(0, 0.48, 0);
      group.add(base);
    }
  });
  return group;
}

function coinsProp(): { group: THREE.Group; coin: THREE.Object3D } {
  const group = new THREE.Group();
  group.add(solid(new THREE.CylinderGeometry(0.5, 0.65, 0.5, 16), lowPoly(0x3d4a5c), [0, 0.25, 0]));
  group.add(solid(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 10), lowPoly(0x3d4a5c), [0, 1, 0]));
  const gold = lowPoly(0xffc93c, { emissive: 0xffb300, emissiveIntensity: 0.25, roughness: 0.35 });
  const coin = new THREE.Group();
  const disc = solid(new THREE.CylinderGeometry(0.85, 0.85, 0.2, 32), gold);
  disc.rotation.x = Math.PI / 2;
  coin.add(disc);
  const ring = solid(new THREE.TorusGeometry(0.66, 0.06, 8, 32), lowPoly(0xf2a900));
  ring.position.z = 0.11;
  coin.add(ring);
  const back = ring.clone();
  back.position.z = -0.11;
  coin.add(back);
  coin.position.y = 2.4;
  group.add(coin);
  return { group, coin };
}

/** Where the stations stand in the town (city coordinates), facing the street. */
const placements: readonly (readonly [Skill, number, number])[] = [
  ['letters', -27, -12],
  ['numbers', 10, -12],
  ['coins', -11, 26],
];

/** The learning stations: big toy objects and a sign; walking up opens the challenges. */
export class LearningStations {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly places: Interactable[] = [];
  private readonly spinning: THREE.Object3D[] = [];

  constructor(groundHeight: number) {
    for (const [skill, x, z] of placements) {
      const look = stationLooks[skill];
      const station = new THREE.Group();
      station.position.set(x, 0, z);
      // Face the main street (z = 0).
      station.rotation.y = z < 0 ? 0 : Math.PI;

      if (skill === 'coins') {
        const { group, coin } = coinsProp();
        station.add(group);
        this.spinning.push(coin);
      } else {
        station.add(skill === 'letters' ? lettersProp() : numbersProp());
      }
      const sign = createPostSign(
        [`${look.icon} ${look.name.toUpperCase()}`],
        { background: look.color, color: '#ffffff', width: 3, height: 0.95 },
        1.6,
      );
      sign.position.set(2.4, 0, 0.4);
      station.add(sign);
      this.group.add(station);

      this.colliders.push(circle(x, z, 1.6));
      const front = z < 0 ? z + 2.6 : z - 2.6;
      this.places.push({
        id: stationId(skill),
        position: new THREE.Vector3(x, groundHeight, front),
        markerPosition: new THREE.Vector3(x, groundHeight + 3.6, z),
        radius: 2.8,
        icon: look.icon,
        label: look.name,
        name: look.name,
      });
    }
  }

  update(time: number): void {
    for (const coin of this.spinning) {
      coin.rotation.y = time * 1.2;
      coin.position.y = 2.4 + Math.sin(time * 1.6) * 0.08;
    }
  }
}
