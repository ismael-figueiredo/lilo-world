import * as THREE from 'three';
import { lowPoly, solid } from '@presentation/world/materials';

/** Reusable low-poly building blocks for the city. All face local +z. */

const glass = () =>
  lowPoly(0xbfe9ff, { emissive: 0x9fdcff, emissiveIntensity: 0.25, roughness: 0.2 });

export interface HouseOptions {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly wall: number;
  readonly roof: number;
  readonly door: number;
}

export function house({ width, depth, height, wall, roof, door }: HouseOptions): THREE.Group {
  const group = new THREE.Group();
  group.add(solid(new THREE.BoxGeometry(width, height, depth), lowPoly(wall), [0, height / 2, 0]));
  group.add(
    solid(new THREE.BoxGeometry(width + 0.3, 0.4, depth + 0.3), lowPoly(0xe9e2d0), [0, 0.2, 0]),
  );

  const overhang = 0.5;
  const roofHeight = width * 0.38;
  const outline = new THREE.Shape();
  outline.moveTo(-width / 2 - overhang, 0);
  outline.lineTo(width / 2 + overhang, 0);
  outline.lineTo(0, roofHeight);
  outline.closePath();
  const roofGeometry = new THREE.ExtrudeGeometry(outline, {
    depth: depth + overhang * 2,
    bevelEnabled: false,
  });
  roofGeometry.translate(0, height, -depth / 2 - overhang);
  group.add(solid(roofGeometry, lowPoly(roof)));
  group.add(
    solid(new THREE.BoxGeometry(0.8, 1.6, 0.8), lowPoly(roof), [
      width * 0.25,
      height + roofHeight * 0.6,
      0,
    ]),
  );

  const front = depth / 2;
  group.add(
    solid(new THREE.BoxGeometry(1.5, 2.4, 0.15), lowPoly(door), [0, 1.2 + 0.3, front + 0.05]),
  );
  group.add(
    solid(new THREE.BoxGeometry(0.16, 0.16, 0.1), lowPoly(0xffd23f), [0.5, 1.5, front + 0.15]),
  );
  for (const x of [-width * 0.3, width * 0.3]) {
    group.add(
      solid(new THREE.BoxGeometry(1.4, 1.3, 0.12), glass(), [x, height * 0.55, front + 0.04]),
    );
    group.add(
      solid(new THREE.BoxGeometry(1.7, 0.18, 0.3), lowPoly(0xffffff), [
        x,
        height * 0.55 - 0.75,
        front + 0.1,
      ]),
    );
  }
  for (const side of [-1, 1]) {
    group.add(
      solid(new THREE.BoxGeometry(0.12, 1.3, 1.4), glass(), [
        (side * width) / 2 + side * 0.04,
        height * 0.55,
        0,
      ]),
    );
  }
  return group;
}

export function shop(options: {
  width: number;
  depth: number;
  height: number;
  wall: number;
  stripes: readonly [number, number];
}): THREE.Group {
  const { width, depth, height, wall, stripes } = options;
  const group = new THREE.Group();
  group.add(solid(new THREE.BoxGeometry(width, height, depth), lowPoly(wall), [0, height / 2, 0]));
  group.add(
    solid(new THREE.BoxGeometry(width + 0.6, 0.5, depth + 0.6), lowPoly(0xf2efe6), [
      0,
      height + 0.25,
      0,
    ]),
  );

  const front = depth / 2;
  group.add(
    solid(new THREE.BoxGeometry(width * 0.7, height * 0.5, 0.12), glass(), [
      0,
      height * 0.32,
      front + 0.04,
    ]),
  );
  group.add(
    solid(
      new THREE.BoxGeometry(2, 2.6, 0.16),
      lowPoly(0x9fe0ff, { emissive: 0x9fe0ff, emissiveIntensity: 0.3 }),
      [0, 1.3, front + 0.08],
    ),
  );

  const stripeCount = 9;
  const stripeWidth = (width + 0.6) / stripeCount;
  for (let i = 0; i < stripeCount; i += 1) {
    const stripe = solid(
      new THREE.BoxGeometry(stripeWidth, 0.12, 1.8),
      lowPoly(i % 2 === 0 ? stripes[0] : stripes[1]),
      [-width / 2 - 0.3 + stripeWidth * (i + 0.5), height * 0.72, front + 0.8],
    );
    stripe.rotation.x = 0.35;
    group.add(stripe);
  }
  return group;
}

export function fruitCrate(fruit: number): THREE.Group {
  const group = new THREE.Group();
  group.add(solid(new THREE.BoxGeometry(1.2, 0.6, 0.8), lowPoly(0xb07a4a), [0, 0.3, 0]));
  const ball = new THREE.IcosahedronGeometry(0.2, 0);
  for (let i = 0; i < 6; i += 1) {
    group.add(solid(ball, lowPoly(fruit), [-0.35 + (i % 3) * 0.35, 0.72, i < 3 ? -0.15 : 0.15]));
  }
  return group;
}

export function streetLamp(): THREE.Group {
  const group = new THREE.Group();
  group.add(solid(new THREE.CylinderGeometry(0.09, 0.13, 4, 6), lowPoly(0x3d4a5c), [0, 2, 0]));
  group.add(
    solid(
      new THREE.IcosahedronGeometry(0.38, 1),
      lowPoly(0xfff3c4, { emissive: 0xffe9a3, emissiveIntensity: 0.8 }),
      [0, 4.2, 0],
    ),
  );
  return group;
}

export function bench(): THREE.Group {
  const group = new THREE.Group();
  const wood = lowPoly(0xc98a4b);
  group.add(solid(new THREE.BoxGeometry(2.2, 0.15, 0.6), wood, [0, 0.55, 0]));
  group.add(solid(new THREE.BoxGeometry(2.2, 0.5, 0.12), wood, [0, 0.95, -0.28]));
  for (const x of [-0.9, 0.9])
    group.add(solid(new THREE.BoxGeometry(0.12, 0.55, 0.5), lowPoly(0x3d4a5c), [x, 0.27, 0]));
  return group;
}

export function busStop(): THREE.Group {
  const group = new THREE.Group();
  const metal = lowPoly(0x3d4a5c);
  for (const x of [-1.8, 1.8])
    group.add(solid(new THREE.BoxGeometry(0.15, 2.8, 0.15), metal, [x, 1.4, -0.6]));
  group.add(solid(new THREE.BoxGeometry(4.2, 0.18, 1.8), lowPoly(0x2e86de), [0, 2.85, 0]));
  group.add(solid(new THREE.BoxGeometry(3.8, 2, 0.08), glass(), [0, 1.4, -0.7]));
  const seat = bench();
  seat.position.set(0, 0, -0.2);
  group.add(seat);
  group.add(solid(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6), metal, [2.6, 1.6, 0.4]));
  return group;
}

export function bus(): THREE.Group {
  const group = new THREE.Group();
  group.add(solid(new THREE.BoxGeometry(8, 2.6, 2.7), lowPoly(0xffb02e), [0, 1.8, 0]));
  group.add(solid(new THREE.BoxGeometry(8.06, 0.9, 2.76), glass(), [0, 2.35, 0]));
  group.add(solid(new THREE.BoxGeometry(8.1, 0.35, 2.8), lowPoly(0xffffff), [0, 1.05, 0]));
  group.add(solid(new THREE.BoxGeometry(7.6, 0.25, 2.4), lowPoly(0xf08c00), [0, 3.2, 0]));
  const wheel = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10);
  wheel.rotateX(Math.PI / 2);
  for (const x of [-2.7, 2.7]) {
    for (const z of [-1.35, 1.35]) group.add(solid(wheel, lowPoly(0x2d3142), [x, 0.55, z]));
  }
  for (const z of [-0.9, 0.9]) {
    group.add(
      solid(
        new THREE.BoxGeometry(0.1, 0.3, 0.4),
        lowPoly(0xfff6cf, { emissive: 0xfff2b0, emissiveIntensity: 0.9 }),
        [4.02, 1.2, z],
      ),
    );
  }
  return group;
}

export function fountain(): { group: THREE.Group; water: THREE.Mesh } {
  const group = new THREE.Group();
  const stone = lowPoly(0xd9d4c7);
  group.add(solid(new THREE.CylinderGeometry(2.6, 2.8, 0.7, 12), stone, [0, 0.35, 0]));
  const water = solid(
    new THREE.CylinderGeometry(2.25, 2.25, 0.1, 12),
    lowPoly(0x5fd3f0, { emissive: 0x5fd3f0, emissiveIntensity: 0.25, roughness: 0.2 }),
    [0, 0.62, 0],
  );
  group.add(water);
  group.add(solid(new THREE.CylinderGeometry(0.3, 0.45, 1.8, 8), stone, [0, 1.2, 0]));
  group.add(solid(new THREE.CylinderGeometry(1, 0.4, 0.4, 10), stone, [0, 2.1, 0]));
  return { group, water };
}

export interface TrafficLight {
  readonly group: THREE.Group;
  update(time: number): void;
}

/** Cycles calmly: long green, short yellow, long red. */
export function trafficLight(): TrafficLight {
  const group = new THREE.Group();
  const metal = lowPoly(0x3d4a5c);
  group.add(solid(new THREE.CylinderGeometry(0.1, 0.13, 3.4, 6), metal, [0, 1.7, 0]));
  group.add(solid(new THREE.BoxGeometry(0.7, 1.9, 0.5), lowPoly(0x2d3142), [0, 4.2, 0]));

  const colors = [0xff4d4d, 0xffc83d, 0x4cd964];
  const lamps = colors.map((color, index) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      emissive: color,
      emissiveIntensity: 0,
    });
    const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), material);
    lamp.position.set(0, 4.8 - index * 0.6, 0.27);
    group.add(lamp);
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
