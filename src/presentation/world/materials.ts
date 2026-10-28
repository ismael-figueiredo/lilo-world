import * as THREE from 'three';

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Shared flat-shaded material: the faceted low-poly look, reused to keep draw cost low. */
export function lowPoly(
  color: number,
  options: { emissive?: number; emissiveIntensity?: number; roughness?: number } = {},
): THREE.MeshStandardMaterial {
  const key = `${color}-${options.emissive ?? 0}-${options.emissiveIntensity ?? 0}-${options.roughness ?? 0.85}`;
  let material = cache.get(key);
  if (material === undefined) {
    material = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: options.roughness ?? 0.85,
      metalness: 0,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0,
    });
    cache.set(key, material);
  }
  return material;
}

/** Mesh that casts and receives shadows, placed in one call. */
export function solid(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: readonly [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
