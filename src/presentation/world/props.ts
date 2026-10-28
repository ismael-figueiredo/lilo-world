import * as THREE from 'three';
import { lowPoly, solid } from '@presentation/world/materials';

/**
 * Street props that have no CC0 model the game can use (or that the game must
 * animate, like the traffic light). Buildings, cars and plants are models; see
 * world-assets.ts. All face local +z.
 */

const glass = () =>
  lowPoly(0xbfe9ff, { emissive: 0x9fdcff, emissiveIntensity: 0.25, roughness: 0.2 });
const metal = () => lowPoly(0x3d4a5c, { roughness: 0.5 });

/** Box with round edges: the "toy" look instead of sharp blocks. */
function roundedBox(width: number, height: number, depth: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = 0;
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const bevel = Math.min(r * 0.6, depth * 0.2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 5,
  });
  geometry.translate(0, 0, -depth / 2 + bevel);
  return geometry;
}

export function streetLamp(): THREE.Group {
  const group = new THREE.Group();
  group.add(solid(new THREE.CylinderGeometry(0.22, 0.3, 0.35, 12), metal(), [0, 0.17, 0]));
  group.add(solid(new THREE.CylinderGeometry(0.07, 0.1, 4.2, 10), metal(), [0, 2.3, 0]));
  const arm = solid(new THREE.TorusGeometry(0.45, 0.05, 6, 12, Math.PI), metal(), [0.45, 4.4, 0]);
  group.add(arm);
  group.add(solid(new THREE.ConeGeometry(0.42, 0.35, 12), metal(), [0.9, 4.3, 0]));
  group.add(
    solid(
      new THREE.SphereGeometry(0.24, 12, 8),
      lowPoly(0xfff3c4, { emissive: 0xffe9a3, emissiveIntensity: 1 }),
      [0.9, 4.12, 0],
    ),
  );
  return group;
}

export function bench(): THREE.Group {
  const group = new THREE.Group();
  const wood = lowPoly(0xd08c4a);
  for (let i = 0; i < 3; i += 1) {
    group.add(solid(roundedBox(2.2, 0.08, 0.18, 0.04), wood, [0, 0.52, -0.2 + i * 0.2]));
  }
  for (let i = 0; i < 2; i += 1) {
    const slat = solid(roundedBox(2.2, 0.16, 0.08, 0.04), wood, [0, 0.75 + i * 0.22, -0.34]);
    slat.rotation.x = -0.15;
    group.add(slat);
  }
  for (const x of [-0.9, 0.9]) {
    group.add(solid(roundedBox(0.1, 0.52, 0.5, 0.04), metal(), [x, 0, 0]));
    group.add(solid(roundedBox(0.1, 0.55, 0.08, 0.04), metal(), [x, 0.55, -0.32]));
  }
  return group;
}

export function busStop(): THREE.Group {
  const group = new THREE.Group();
  for (const x of [-1.8, 1.8])
    group.add(solid(new THREE.CylinderGeometry(0.07, 0.07, 2.8, 10), metal(), [x, 1.4, -0.6]));
  const roof = solid(roundedBox(4.4, 0.2, 1.9, 0.1), lowPoly(0x2e86de), [0, 2.8, 0]);
  group.add(roof);
  group.add(solid(new THREE.BoxGeometry(3.6, 1.9, 0.06), glass(), [0, 1.45, -0.66]));
  const seat = bench();
  seat.position.set(0, 0, -0.2);
  group.add(seat);
  return group;
}

export function bus(): THREE.Group {
  const group = new THREE.Group();
  const yellow = lowPoly(0xffb02e, { roughness: 0.6 });
  // Body along local x, so the bus drives sideways along the street.
  const body = solid(roundedBox(8, 2.7, 2.6, 0.55), yellow, [0, 0.55, 0]);
  group.add(body);
  group.add(solid(roundedBox(7.6, 0.18, 2.66, 0.08), lowPoly(0xffffff), [0, 1.2, 0]));
  group.add(solid(roundedBox(7.4, 0.25, 2.3, 0.12), lowPoly(0xf08c00), [0, 3.2, 0]));

  const windowMaterial = lowPoly(0x2b3a55, {
    emissive: 0x9fdcff,
    emissiveIntensity: 0.12,
    roughness: 0.15,
  });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i += 1) {
      group.add(
        solid(roundedBox(1.15, 0.85, 0.06, 0.15), windowMaterial, [
          -2.9 + i * 1.35,
          2.05,
          side * 1.31,
        ]),
      );
    }
  }
  const windshield = solid(roundedBox(2.1, 1.05, 0.06, 0.15), windowMaterial, [4.02, 1.85, 0]);
  windshield.rotation.y = Math.PI / 2;
  group.add(windshield);
  // Door on the curb side (local -z).
  group.add(solid(roundedBox(1, 1.9, 0.06, 0.1), windowMaterial, [2.9, 0.75, -1.31]));

  const tire = new THREE.CylinderGeometry(0.55, 0.55, 0.42, 16);
  tire.rotateX(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.26, 0.26, 0.44, 12);
  hub.rotateX(Math.PI / 2);
  for (const x of [-2.6, 2.6]) {
    for (const z of [-1.2, 1.2]) {
      group.add(solid(tire, lowPoly(0x2d3142), [x, 0.55, z]));
      group.add(solid(hub, lowPoly(0xd9dde6), [x, 0.55, z]));
    }
  }
  for (const z of [-0.85, 0.85]) {
    group.add(
      solid(
        new THREE.SphereGeometry(0.17, 10, 8),
        lowPoly(0xfff6cf, { emissive: 0xfff2b0, emissiveIntensity: 0.9 }),
        [4.05, 1.0, z],
      ),
    );
  }
  return group;
}

export function fountain(): { group: THREE.Group; water: THREE.Mesh } {
  const group = new THREE.Group();
  const stone = lowPoly(0xe3ddd0);
  const rim = lowPoly(0xcfc6b4);
  group.add(solid(new THREE.CylinderGeometry(2.7, 2.9, 0.6, 28), stone, [0, 0.3, 0]));
  group.add(solid(new THREE.TorusGeometry(2.55, 0.16, 8, 32), rim, [0, 0.62, 0]));
  (group.children.at(-1) as THREE.Mesh).rotation.x = Math.PI / 2;
  const water = solid(
    new THREE.CylinderGeometry(2.4, 2.4, 0.1, 28),
    lowPoly(0x5fd3f0, { emissive: 0x5fd3f0, emissiveIntensity: 0.25, roughness: 0.15 }),
    [0, 0.62, 0],
  );
  group.add(water);
  group.add(solid(new THREE.CylinderGeometry(0.3, 0.45, 1.8, 14), stone, [0, 1.2, 0]));
  group.add(solid(new THREE.CylinderGeometry(1.05, 0.45, 0.35, 20), rim, [0, 2.1, 0]));
  group.add(
    solid(
      new THREE.SphereGeometry(0.3, 14, 10),
      lowPoly(0x9fe8ff, { emissive: 0x9fe8ff, emissiveIntensity: 0.4, roughness: 0.1 }),
      [0, 2.45, 0],
    ),
  );
  return { group, water };
}

export interface TrafficLight {
  readonly group: THREE.Group;
  update(time: number): void;
}

/** Cycles calmly: long green, short yellow, long red. */
export function trafficLight(): TrafficLight {
  const group = new THREE.Group();
  group.add(solid(new THREE.CylinderGeometry(0.2, 0.26, 0.3, 12), metal(), [0, 0.15, 0]));
  group.add(solid(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 10), metal(), [0, 1.8, 0]));
  group.add(solid(roundedBox(0.72, 1.95, 0.5, 0.16), lowPoly(0x2d3142), [0, 3.25, 0]));

  const colors = [0xff4d4d, 0xffc83d, 0x4cd964];
  const visor = new THREE.CylinderGeometry(0.27, 0.27, 0.22, 14, 1, true, -Math.PI / 2, Math.PI);
  visor.rotateX(Math.PI / 2);
  const lamps = colors.map((color, index) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      emissive: color,
      emissiveIntensity: 0,
    });
    const y = 4.8 - index * 0.6;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10), material);
    lamp.position.set(0, y, 0.22);
    group.add(lamp);
    group.add(solid(visor, lowPoly(0x2d3142), [0, y + 0.02, 0.33]));
    return material;
  });

  return {
    group,
    update(time: number) {
      const phase = time % 14;
      const active = phase < 6 ? 2 : phase < 8 ? 1 : 0;
      lamps.forEach((material, index) => {
        material.emissiveIntensity = index === active ? 1.4 : 0.02;
      });
    },
  };
}
