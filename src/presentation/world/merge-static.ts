import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Flat-shaded pieces: only their shape matters, so they can share one draw. */
const mergeable = (object: THREE.Object3D): object is THREE.Mesh => {
  if (!(object instanceof THREE.Mesh) || object.constructor !== THREE.Mesh) return false;
  const material = object.material as THREE.Material | THREE.Material[];
  const geometry = object.geometry as THREE.BufferGeometry;
  return (
    material instanceof THREE.MeshStandardMaterial &&
    material.map === null &&
    material.flatShading &&
    geometry.getAttribute('position').array instanceof Float32Array
  );
};

/** The shape alone, in `root`'s coordinates. */
function shapeOf(mesh: THREE.Mesh, toRoot: THREE.Matrix4): THREE.BufferGeometry {
  const source = mesh.geometry.index === null ? mesh.geometry : mesh.geometry.toNonIndexed();
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', source.getAttribute('position').clone());
  shape.setAttribute('normal', source.getAttribute('normal').clone());
  shape.applyMatrix4(toRoot.clone().multiply(mesh.matrixWorld));
  return shape;
}

/**
 * Joins pieces that never move and share a material into one mesh per
 * material: hundreds of lamp posts and curbs become a few draws. Anything under
 * `moving` stays as it is.
 */
export function mergeStatic(root: THREE.Object3D, moving: readonly THREE.Object3D[] = []): void {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const groups = new Map<string, THREE.Mesh[]>();
  const visit = (object: THREE.Object3D): void => {
    if (moving.includes(object)) return;
    if (mergeable(object)) {
      const key = `${(object.material as THREE.Material).uuid}-${String(object.castShadow)}`;
      groups.set(key, [...(groups.get(key) ?? []), object]);
    }
    object.children.forEach(visit);
  };
  visit(root);

  for (const meshes of groups.values()) {
    const [first] = meshes;
    if (first === undefined || meshes.length < 2) continue;
    const merged = mergeGeometries(meshes.map((mesh) => shapeOf(mesh, toRoot)));
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    root.add(mesh);
    for (const piece of meshes) piece.removeFromParent();
  }
}
