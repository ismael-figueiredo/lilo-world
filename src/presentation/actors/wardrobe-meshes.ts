import * as THREE from 'three';
import type { WardrobeLook } from '@domain/avatar/wardrobe-item';
import { lowPoly, solid } from '@presentation/world/materials';

/** Where an accessory is worn on the body. */
export type Anchor = 'head-top' | 'face' | 'back';

export interface AccessoryModel {
  readonly anchor: Anchor;
  readonly object: THREE.Object3D;
}

/**
 * 3D models for wardrobe looks, built at "head width = 1" scale. The player
 * scales them to fit its own head.
 */
export function buildAccessory(look: WardrobeLook, color: number): AccessoryModel | undefined {
  const main = lowPoly(color);
  const group = new THREE.Group();

  switch (look) {
    case 'cap': {
      const dome = new THREE.SphereGeometry(0.52, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      group.add(solid(dome, main, [0, -0.06, 0]));
      const visor = solid(
        new THREE.CylinderGeometry(0.42, 0.42, 0.05, 14, 1, false, -Math.PI / 2, Math.PI),
        main,
        [0, -0.04, 0.3],
      );
      visor.scale.set(1, 1, 0.9);
      group.add(visor);
      group.add(solid(new THREE.IcosahedronGeometry(0.07, 0), lowPoly(0xffffff), [0, 0.46, 0]));
      return { anchor: 'head-top', object: group };
    }
    case 'party-hat': {
      group.add(solid(new THREE.ConeGeometry(0.34, 0.85, 10), main, [0, 0.4, 0]));
      group.add(
        solid(new THREE.TorusGeometry(0.33, 0.05, 6, 16), lowPoly(0xffd23f), [0, 0.02, 0]).rotateX(
          Math.PI / 2,
        ),
      );
      group.add(solid(new THREE.IcosahedronGeometry(0.11, 1), lowPoly(0xffd23f), [0, 0.86, 0]));
      return { anchor: 'head-top', object: group };
    }
    case 'beanie': {
      group.add(
        solid(
          new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          main,
          [0, -0.08, 0],
        ),
      );
      group.add(
        solid(new THREE.TorusGeometry(0.48, 0.08, 6, 18), lowPoly(0xffffff), [0, -0.06, 0]).rotateX(
          Math.PI / 2,
        ),
      );
      group.add(solid(new THREE.IcosahedronGeometry(0.14, 1), lowPoly(0xffffff), [0, 0.46, 0]));
      return { anchor: 'head-top', object: group };
    }
    case 'crown': {
      const gold = lowPoly(color, { emissive: color, emissiveIntensity: 0.25, roughness: 0.4 });
      group.add(
        solid(new THREE.CylinderGeometry(0.4, 0.42, 0.22, 10, 1, true), gold, [0, 0.08, 0]),
      );
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2;
        group.add(
          solid(new THREE.ConeGeometry(0.09, 0.24, 5), gold, [
            Math.sin(angle) * 0.4,
            0.3,
            Math.cos(angle) * 0.4,
          ]),
        );
        group.add(
          solid(
            new THREE.IcosahedronGeometry(0.05, 0),
            lowPoly(i % 2 === 0 ? 0xff4d6d : 0x4dc3ff),
            [Math.sin(angle) * 0.42, 0.1, Math.cos(angle) * 0.42],
          ),
        );
      }
      return { anchor: 'head-top', object: group };
    }
    case 'glasses': {
      for (const x of [-0.2, 0.2]) {
        group.add(solid(new THREE.TorusGeometry(0.13, 0.03, 6, 16), main, [x, 0, 0]));
        const lens = new THREE.Mesh(
          new THREE.CircleGeometry(0.12, 16),
          new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.35 }),
        );
        lens.position.set(x, 0, -0.005);
        group.add(lens);
      }
      group.add(solid(new THREE.BoxGeometry(0.14, 0.03, 0.03), main, [0, 0.02, 0]));
      return { anchor: 'face', object: group };
    }
    case 'backpack': {
      group.add(solid(new THREE.BoxGeometry(0.7, 0.8, 0.35), main, [0, 0, -0.18]));
      group.add(solid(new THREE.BoxGeometry(0.72, 0.3, 0.38), lowPoly(0xffffff), [0, 0.28, -0.18]));
      group.add(solid(new THREE.BoxGeometry(0.5, 0.3, 0.12), main, [0, -0.15, -0.38]));
      return { anchor: 'back', object: group };
    }
    case 'headphones': {
      const band = solid(new THREE.TorusGeometry(0.52, 0.05, 6, 20, Math.PI), main, [0, -0.15, 0]);
      group.add(band);
      for (const x of [-0.52, 0.52]) {
        const cup = solid(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12), lowPoly(0x2d3142), [
          x,
          -0.2,
          0,
        ]);
        cup.rotation.z = Math.PI / 2;
        group.add(cup);
      }
      return { anchor: 'head-top', object: group };
    }
    case 'color':
      return undefined;
  }
}
