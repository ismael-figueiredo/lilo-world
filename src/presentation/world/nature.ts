import * as THREE from 'three';
import { randomBetween, type Random } from '@presentation/engine/math';
import { circle, type Collider } from '@presentation/world/collision';
import { lowPoly } from '@presentation/world/materials';
import type { TerrainShape } from '@presentation/world/terrain-shape';

export interface NatureOptions {
  /** Places where nothing should grow (city, paths, portal plaza). */
  readonly keepClear: (x: number, z: number) => boolean;
}

interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
  readonly rotation: number;
}

const greens = [0x4fb847, 0x3fa34a, 0x62c454, 0x2f8f45, 0x77cc4f];
const flowerColors = [0xff6b8b, 0xffd23f, 0xffffff, 0xb48cff, 0xff9f43];

/** Trees, rocks, bushes, grass and flowers, drawn with instancing so tablets stay smooth. */
export class Nature {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  private readonly clouds: THREE.Group[] = [];

  constructor(
    private readonly shape: TerrainShape,
    private readonly random: Random,
    private readonly options: NatureOptions,
  ) {
    this.addTrees();
    this.addRocks();
    this.addGround();
    this.addClouds();
  }

  update(dt: number): void {
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 1.6;
      if (cloud.position.x > 260) cloud.position.x = -260;
    }
  }

  private scatter(count: number, minHeight: number, spacing = 0): Placement[] {
    const placements: Placement[] = [];
    let tries = 0;
    while (placements.length < count && tries < count * 30) {
      tries += 1;
      const angle = this.random() * Math.PI * 2;
      const distance = Math.sqrt(this.random()) * 125;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = this.shape.heightAt(x, z);
      if (y < minHeight || this.options.keepClear(x, z)) continue;
      if (spacing > 0 && placements.some((p) => Math.hypot(p.x - x, p.z - z) < spacing)) continue;
      placements.push({
        x,
        y,
        z,
        scale: randomBetween(this.random, 0.8, 1.35),
        rotation: this.random() * Math.PI * 2,
      });
    }
    return placements;
  }

  private instanced(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    placements: readonly Placement[],
    transform: (p: Placement, matrix: THREE.Matrix4) => void,
    colors?: readonly number[],
    shadows = true,
  ): void {
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    placements.forEach((placement, index) => {
      transform(placement, matrix);
      mesh.setMatrixAt(index, matrix);
      if (colors !== undefined) {
        mesh.setColorAt(
          index,
          color.setHex(colors[Math.floor(this.random() * colors.length)] ?? 0xffffff),
        );
      }
    });
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private addTrees(): void {
    const white = lowPoly(0xffffff);
    const trunk = lowPoly(0x8a5a3b);
    const all = this.scatter(260, 1.4, 3.2);
    const round = all.filter((_, i) => i % 3 !== 0);
    const pines = all.filter((_, i) => i % 3 === 0);
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const at = (p: Placement, dy: number, s: number, m: THREE.Matrix4) =>
      m.compose(
        new THREE.Vector3(p.x, p.y + dy * p.scale, p.z),
        q.setFromAxisAngle(up, p.rotation),
        new THREE.Vector3(s * p.scale, s * p.scale, s * p.scale),
      );

    const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.34, 2, 6);
    this.instanced(trunkGeometry, trunk, all, (p, m) => at(p, 1, 1, m));

    const crown = new THREE.IcosahedronGeometry(1.5, 0);
    this.instanced(crown, white, round, (p, m) => at(p, 2.8, 1, m), greens);
    const crownTop = new THREE.IcosahedronGeometry(1.05, 0);
    this.instanced(crownTop, white, round, (p, m) => at(p, 3.9, 1, m), greens);

    const pineLow = new THREE.ConeGeometry(1.5, 2.6, 7);
    this.instanced(pineLow, white, pines, (p, m) => at(p, 2.6, 1, m), [0x2f8f55, 0x2a7d4f]);
    const pineHigh = new THREE.ConeGeometry(1.05, 2.1, 7);
    this.instanced(pineHigh, white, pines, (p, m) => at(p, 3.9, 1, m), [0x3aa565, 0x34965b]);

    for (const p of all) this.colliders.push(circle(p.x, p.z, 0.45 * p.scale));
  }

  private addRocks(): void {
    const rocks = this.scatter(90, 0.3, 2);
    const geometry = new THREE.DodecahedronGeometry(0.9, 0);
    const position = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i += 1) {
      position.setXYZ(
        i,
        position.getX(i) * randomBetween(this.random, 0.8, 1.2),
        position.getY(i) * 0.7,
        position.getZ(i) * randomBetween(this.random, 0.8, 1.2),
      );
    }
    geometry.computeVertexNormals();
    this.instanced(
      geometry,
      lowPoly(0xffffff),
      rocks,
      (p, m) => {
        m.compose(
          new THREE.Vector3(p.x, p.y + 0.2, p.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.rotation, 0)),
          new THREE.Vector3(p.scale, p.scale, p.scale),
        );
      },
      [0xb3b0a4, 0x9c9a90, 0xc4c1b5],
    );
    for (const p of rocks) this.colliders.push(circle(p.x, p.z, 0.75 * p.scale));
  }

  private addGround(): void {
    const bushes = this.scatter(160, 1.2);
    this.instanced(
      new THREE.IcosahedronGeometry(0.7, 0),
      lowPoly(0xffffff),
      bushes,
      (p, m) => {
        m.compose(
          new THREE.Vector3(p.x, p.y + 0.35, p.z),
          new THREE.Quaternion(),
          new THREE.Vector3(p.scale * 1.2, p.scale * 0.8, p.scale * 1.2),
        );
      },
      greens,
    );

    const grass = this.scatter(2600, 1.1);
    this.instanced(
      new THREE.ConeGeometry(0.07, 0.55, 3),
      lowPoly(0xffffff),
      grass,
      (p, m) => {
        m.compose(
          new THREE.Vector3(p.x, p.y + 0.25 * p.scale, p.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, p.rotation, 0.1)),
          new THREE.Vector3(p.scale, p.scale, p.scale),
        );
      },
      [0x5fbf45, 0x78d257, 0x4caa3c],
      false,
    );

    const flowers = this.scatter(700, 1.2);
    this.instanced(
      new THREE.IcosahedronGeometry(0.14, 0),
      lowPoly(0xffffff),
      flowers,
      (p, m) => {
        m.compose(
          new THREE.Vector3(p.x, p.y + 0.3, p.z),
          new THREE.Quaternion(),
          new THREE.Vector3(p.scale, p.scale * 0.7, p.scale),
        );
      },
      flowerColors,
      false,
    );
  }

  private addClouds(): void {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
      emissive: 0xffffff,
      emissiveIntensity: 0.25,
    });
    const puff = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 18; i += 1) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(this.random() * 3);
      for (let j = 0; j < puffs; j += 1) {
        const mesh = new THREE.Mesh(puff, material);
        const size = randomBetween(this.random, 4, 7);
        mesh.scale.set(size, size * 0.7, size);
        mesh.position.set(
          j * 5 - puffs * 2.5,
          randomBetween(this.random, -1, 1.5),
          randomBetween(this.random, -2, 2),
        );
        cloud.add(mesh);
      }
      cloud.position.set(
        randomBetween(this.random, -260, 260),
        randomBetween(this.random, 55, 80),
        randomBetween(this.random, -220, 220),
      );
      this.clouds.push(cloud);
      this.group.add(cloud);
    }
  }
}
