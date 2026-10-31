import * as THREE from 'three';
import { lowPoly, solid } from '@presentation/world/materials';

const trunk = new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6);
const crown = new THREE.IcosahedronGeometry(1.5, 1);
const palmTrunk = new THREE.CylinderGeometry(0.12, 0.2, 4.4, 6);
const frond = new THREE.BoxGeometry(2.2, 0.06, 0.5);

/** A tree of the background: seen from afar, never walked to. */
export function roundTree(x: number, z: number, size: number, green: number): THREE.Group {
  const tree = new THREE.Group();
  tree.add(solid(trunk, lowPoly(0x7a5230), [0, 0.8, 0]), solid(crown, lowPoly(green), [0, 2.6, 0]));
  tree.position.set(x, 0, z);
  tree.scale.setScalar(size);
  return tree;
}

export function palmTree(x: number, z: number, size: number): THREE.Group {
  const tree = new THREE.Group();
  const stem = solid(palmTrunk, lowPoly(0xa8784a), [0, 2.2, 0]);
  stem.rotation.z = 0.08;
  tree.add(stem);
  for (let leaf = 0; leaf < 6; leaf += 1) {
    const angle = (leaf / 6) * Math.PI * 2;
    const blade = solid(frond, lowPoly(0x4f9d4a), [
      Math.cos(angle) * 0.95,
      4.2,
      Math.sin(angle) * 0.95,
    ]);
    blade.rotation.set(0, -angle, -0.35);
    tree.add(blade);
  }
  tree.position.set(x, 0, z);
  tree.scale.setScalar(size);
  return tree;
}

/** Trees all around a place, so it ends in a landscape and not in the void. */
export function treeRing(radius: number, count: number, skip?: number): THREE.Group {
  const ring = new THREE.Group();
  const greens = [0x4f9d4a, 0x5fae5a, 0x3f8f52];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    if (skip !== undefined && Math.abs(Math.sin(angle) - skip) < 0.04) continue;
    const distance = radius + (index % 3) * 2.6;
    ring.add(
      roundTree(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        1.1 + (index % 4) * 0.25,
        greens[index % greens.length] ?? 0x4f9d4a,
      ),
    );
  }
  return ring;
}
