import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lowPoly } from '@presentation/world/materials';
import { mergeStatic } from '@presentation/world/merge-static';

const box = (x: number, material: THREE.Material = lowPoly(0x336699)): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.position.x = x;
  return mesh;
};

const meshesIn = (root: THREE.Object3D): THREE.Mesh[] => {
  const found: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) found.push(child as THREE.Mesh);
  });
  return found;
};

describe('joining static pieces', () => {
  it('turns pieces of one material into a single mesh, where they stood', () => {
    const root = new THREE.Group();
    const parent = new THREE.Group();
    parent.position.x = 10;
    parent.add(box(0), box(5));
    root.add(parent);

    mergeStatic(root);

    const [merged, ...others] = meshesIn(root);
    expect(others).toEqual([]);
    merged?.geometry.computeBoundingBox();
    expect(merged?.geometry.boundingBox?.min.x).toBeCloseTo(9.5);
    expect(merged?.geometry.boundingBox?.max.x).toBeCloseTo(15.5);
  });

  it('keeps materials apart', () => {
    const root = new THREE.Group();
    root.add(box(0), box(1), box(2, lowPoly(0xff0000)), box(3, lowPoly(0xff0000)));
    mergeStatic(root);
    expect(meshesIn(root)).toHaveLength(2);
  });

  it('leaves what moves untouched', () => {
    const root = new THREE.Group();
    const light = box(0);
    root.add(light, box(1), box(2));
    mergeStatic(root, [light]);
    expect(light.parent).toBe(root);
    expect(meshesIn(root)).toHaveLength(2);
  });

  it('leaves what is painted or has one piece only', () => {
    const root = new THREE.Group();
    const painted = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    root.add(box(0, painted), box(1, painted), box(2));
    mergeStatic(root);
    expect(meshesIn(root)).toHaveLength(3);
  });
});
