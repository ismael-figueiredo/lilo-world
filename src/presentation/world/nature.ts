import * as THREE from 'three';
import { randomBetween, type Random } from '@presentation/engine/math';
import { circle, type Collider } from '@presentation/world/collision';
import type { TerrainShape } from '@presentation/world/terrain-shape';
import type { WorldAssets, WorldModelId } from '@presentation/world/world-assets';

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

/** How tall each plant model is drawn (before the random size of each one). */
const TREE_HEIGHTS: readonly (readonly [WorldModelId, number])[] = [
  ['tree-round', 6.2],
  ['tree-tall', 6.8],
  ['tree-twin', 6],
  ['tree-slim', 6.6],
  ['pine', 7.4],
  ['pine-wide', 6.8],
  ['birch', 5.8],
];

/** Trees, rocks, bushes, grass and flowers, drawn with instancing so tablets stay smooth. */
export class Nature {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  /** Grass, flowers and mushrooms: pretty, and the first thing to go on a slow tablet. */
  private readonly cover = new THREE.Group();
  private readonly clouds: THREE.Group[] = [];
  private readonly cloudSurface = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    flatShading: true,
    roughness: 1,
    emissive: 0xffffff,
    emissiveIntensity: 0.25,
  });

  constructor(
    private readonly shape: TerrainShape,
    private readonly random: Random,
    private readonly assets: WorldAssets,
    private readonly options: NatureOptions,
  ) {
    this.addTrees();
    this.addRocks();
    this.addGround();
    this.addClouds();
    this.group.add(this.cover);
  }

  /** On a slow tablet: no ground cover, and trees stop drawing a second time for the shadows. */
  setDetailed(detailed: boolean): void {
    this.cover.visible = detailed;
    for (const child of this.group.children) child.castShadow = detailed;
  }

  setCloudsVisible(visible: boolean): void {
    for (const cloud of this.clouds) cloud.visible = visible;
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

  /** Patches of plants: a few centers, each with several plants close together. */
  private clusters(centers: number, perCluster: number, radius: number, minHeight: number) {
    const placements: Placement[] = [];
    for (const center of this.scatter(centers, minHeight, radius * 2)) {
      for (let i = 0; i < perCluster; i += 1) {
        const angle = this.random() * Math.PI * 2;
        const distance = Math.sqrt(this.random()) * radius;
        const x = center.x + Math.cos(angle) * distance;
        const z = center.z + Math.sin(angle) * distance;
        const y = this.shape.heightAt(x, z);
        if (y < minHeight || this.options.keepClear(x, z)) continue;
        placements.push({
          x,
          y,
          z,
          scale: randomBetween(this.random, 0.75, 1.25),
          rotation: this.random() * Math.PI * 2,
        });
      }
    }
    return placements;
  }

  /**
   * Draws a model at every placement: one InstancedMesh per mesh of the model.
   * `height` is the size of the model at scale 1; `sink` pushes roots into slopes.
   */
  private instanced(
    model: WorldModelId,
    placements: readonly Placement[],
    height: number,
    {
      sink = 0,
      shadows = true,
      target = this.group,
    }: { sink?: number; shadows?: boolean; target?: THREE.Group } = {},
  ): void {
    if (placements.length === 0) return;
    const fit = height / Math.max(this.assets.size(model).y, 0.001);
    const place = new THREE.Matrix4();
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const part of this.assets.parts(model)) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
      placements.forEach((p, index) => {
        const size = fit * p.scale;
        place.compose(
          new THREE.Vector3(p.x, p.y - sink * size, p.z),
          rotation.setFromAxisAngle(up, p.rotation),
          new THREE.Vector3(size, size, size),
        );
        mesh.setMatrixAt(index, matrix.multiplyMatrices(place, part.matrix));
      });
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      target.add(mesh);
    }
  }

  /** Splits placements among models in turn, so each kind is spread over the island. */
  private static deal<T>(items: readonly T[], kinds: number): T[][] {
    const hands: T[][] = Array.from({ length: kinds }, () => []);
    items.forEach((item, index) => hands[index % kinds]?.push(item));
    return hands;
  }

  private addTrees(): void {
    const all = this.scatter(130, 1.4, 3.4);
    Nature.deal(all, TREE_HEIGHTS.length).forEach((placements, index) => {
      const [model, height] = TREE_HEIGHTS[index] ?? TREE_HEIGHTS[0] ?? ['tree-round', 6];
      this.instanced(model, placements, height, { sink: 0.02 });
    });
    for (const p of all) this.colliders.push(circle(p.x, p.z, 0.45 * p.scale));
  }

  private addRocks(): void {
    const rocks = this.scatter(90, 0.9, 2);
    const [big = [], medium = [], small = []] = Nature.deal(rocks, 3);
    this.instanced('rock-big', big, 1.5, { sink: 0.12 });
    this.instanced('rock-medium', medium, 1.2, { sink: 0.08 });
    this.instanced('rock-small', small, 0.8, { sink: 0.1 });
    for (const p of rocks) this.colliders.push(circle(p.x, p.z, 0.75 * p.scale));
  }

  private addGround(): void {
    const [bushes = [], flowering = []] = Nature.deal(this.clusters(30, 3, 2.5, 1.2), 2);
    this.instanced('bush', bushes, 1.5, { sink: 0.15 });
    this.instanced('bush-flowers', flowering, 1.5, { sink: 0.1 });

    const cover = { shadows: false, target: this.cover };
    this.instanced('grass-tall', this.scatter(700, 1.1), 0.85, cover);
    this.instanced('grass-wide', this.scatter(160, 1.1), 0.7, cover);
    this.instanced('flower-group', this.clusters(18, 5, 3, 1.2), 1, cover);
    this.instanced('flowers', this.clusters(22, 4, 3, 1.2), 0.7, cover);
    this.instanced('mushroom', this.scatter(24, 1.4), 0.5, cover);
  }

  /** Heavier, darker clouds on grey days; `shade` goes from 0 (white) to 1. */
  setClouds(shade: number): void {
    const level = 1 - shade * 0.5;
    this.cloudSurface.color.setRGB(level, level, level * 1.04);
    this.cloudSurface.emissiveIntensity = 0.25 * (1 - shade);
    for (const cloud of this.clouds) cloud.scale.setScalar(1 + shade * 0.7);
  }

  private addClouds(): void {
    const material = this.cloudSurface;
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
