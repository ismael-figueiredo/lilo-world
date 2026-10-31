import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneWithSkeleton } from 'three/addons/utils/SkeletonUtils.js';

/**
 * Models of the world (built by `pnpm assets` from scripts/world-assets.json
 * into public/models/world). Every model stands on the origin.
 */
export const worldModelIds = [
  'house-gable',
  'house-porch',
  'shop-wide',
  'shop-tall',
  'market-stall',
  'car',
  'suv',
  'taxi',
  'tree-round',
  'tree-tall',
  'tree-twin',
  'tree-slim',
  'pine',
  'pine-wide',
  'birch',
  'bush',
  'bush-flowers',
  'flower-group',
  'flowers',
  'grass-wide',
  'grass-tall',
  'rock-big',
  'rock-medium',
  'rock-small',
  'mushroom',
  'cow',
  'pig',
  'sheep',
  'horse',
  'chick',
] as const;

export type WorldModelId = (typeof worldModelIds)[number];

/** New colors by material name, e.g. { White: 0xffe3ec } for the walls of a house. */
export type Recolor = Readonly<Record<string, number>>;

/** One mesh of a model, ready to be drawn many times with an InstancedMesh. */
export interface ModelPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
  /** Placement of the mesh inside the model (quantized models carry a scale here). */
  readonly matrix: THREE.Matrix4;
}

export const worldModelUrl = (baseUrl: string, id: WorldModelId): string =>
  `${baseUrl}models/world/${id}.glb`;

/** Used by the farm only: they come with it. */
const zoneModelIds: readonly WorldModelId[] = ['cow', 'pig', 'sheep', 'horse', 'chick'];

/** Loads models once: most before the island is built, the others with their zone. */
export class WorldAssets {
  private readonly recolored = new Map<string, THREE.Material>();
  private readonly partsCache = new Map<WorldModelId, ModelPart[]>();

  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private readonly scenes = new Map<WorldModelId, THREE.Group>();

  private constructor(private readonly baseUrl: string) {}

  /** `onProgress` receives how much is done, from 0 to 1. */
  static async load(baseUrl: string, onProgress?: (done: number) => void): Promise<WorldAssets> {
    const assets = new WorldAssets(baseUrl);
    const ids = worldModelIds.filter((id) => !zoneModelIds.includes(id));
    await assets.add(ids, (loaded) => onProgress?.(loaded / ids.length));
    return assets;
  }

  async add(ids: readonly WorldModelId[], onLoaded?: (loaded: number) => void): Promise<void> {
    let loaded = 0;
    await Promise.all(
      ids
        .filter((id) => !this.scenes.has(id))
        .map(async (id) => {
          const gltf = await this.loader.loadAsync(worldModelUrl(this.baseUrl, id));
          prepare(gltf.scene);
          this.scenes.set(id, gltf.scene);
          loaded += 1;
          onLoaded?.(loaded);
        }),
    );
  }

  /** A fresh copy of a model (geometry is shared), optionally with new colors. */
  clone(id: WorldModelId, recolor: Recolor = {}): THREE.Group {
    // Animals are skinned: a plain clone would lose their skeleton and vanish.
    const copy = cloneWithSkeleton(this.scene(id)) as THREE.Group;
    copy.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = this.recolor(child.material as THREE.Material | THREE.Material[], recolor);
      }
    });
    return copy;
  }

  /** The meshes of a model with their placement, for instancing. */
  parts(id: WorldModelId): readonly ModelPart[] {
    let parts = this.partsCache.get(id);
    if (parts === undefined) {
      const scene = this.scene(id);
      scene.updateMatrixWorld(true);
      parts = [];
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
          parts?.push({
            geometry: child.geometry as THREE.BufferGeometry,
            material: child.material as THREE.Material,
            matrix: child.matrixWorld.clone(),
          });
        }
      });
      this.partsCache.set(id, parts);
    }
    return parts;
  }

  /** Size of a model as loaded (x = width, y = height, z = depth). */
  size(id: WorldModelId): THREE.Vector3 {
    return new THREE.Box3().setFromObject(this.scene(id)).getSize(new THREE.Vector3());
  }

  private scene(id: WorldModelId): THREE.Group {
    const scene = this.scenes.get(id);
    if (scene === undefined) throw new Error(`World model not loaded: ${id}`);
    return scene;
  }

  private recolor(
    material: THREE.Material | THREE.Material[],
    recolor: Recolor,
  ): THREE.Material | THREE.Material[] {
    if (Array.isArray(material)) return material;
    const color = recolor[material.name];
    if (color === undefined || !(material instanceof THREE.MeshStandardMaterial)) return material;
    const key = `${material.uuid}-${color}`;
    let copy = this.recolored.get(key);
    if (copy === undefined) {
      copy = material.clone();
      (copy as THREE.MeshStandardMaterial).color.setHex(color);
      this.recolored.set(key, copy);
    }
    return copy;
  }
}

/** Shadows on, the matte toy look, and cut-out leaves that do not sort badly. */
function prepare(scene: THREE.Group): void {
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const material = child.material as THREE.Material;
    if (!(material instanceof THREE.MeshStandardMaterial)) return;
    material.metalness = 0;
    material.roughness = Math.max(material.roughness, 0.8);
    // Models without normals (simplified houses) are drawn faceted.
    if (!(child.geometry as THREE.BufferGeometry).hasAttribute('normal')) {
      material.flatShading = true;
    }
    if (material.map !== null && material.transparent) {
      // Blended materials come without depth writes; cut-outs need them, or the
      // ground drawn later covers the leaves.
      material.transparent = false;
      material.depthWrite = true;
      material.alphaTest = 0.5;
      material.side = THREE.DoubleSide;
    }
  });
}

/** Uniform scale so the model's footprint fits inside width × depth. */
export function fitFootprint(object: THREE.Object3D, width: number, depth: number): number {
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  const scale = Math.min(width / Math.max(size.x, 0.001), depth / Math.max(size.z, 0.001));
  object.scale.setScalar(scale);
  return scale;
}

/** Uniform scale so the model is this tall. */
export function fitHeight(object: THREE.Object3D, height: number): number {
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  const scale = height / Math.max(size.y, 0.001);
  object.scale.setScalar(scale);
  return scale;
}
