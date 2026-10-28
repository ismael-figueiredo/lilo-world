import * as THREE from 'three';
import { WATER_LEVEL } from '@presentation/world/terrain-shape';

/** Calm sea with slow, gentle waves (no fast motion that could overwhelm). */
export class Water {
  readonly mesh: THREE.Mesh;
  private readonly base: Float32Array;

  constructor() {
    const geometry = new THREE.PlaneGeometry(800, 800, 100, 100);
    geometry.rotateX(-Math.PI / 2);
    this.base = Float32Array.from((geometry.attributes.position as THREE.BufferAttribute).array);

    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0x3cc1e0,
        transparent: true,
        opacity: 0.84,
        roughness: 0.18,
        metalness: 0.05,
        flatShading: true,
      }),
    );
    this.mesh.position.y = WATER_LEVEL - 0.05;
    this.mesh.receiveShadow = true;
  }

  update(time: number): void {
    const position = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i += 1) {
      const x = this.base[i * 3] ?? 0;
      const z = this.base[i * 3 + 2] ?? 0;
      position.setY(
        i,
        Math.sin(x * 0.07 + time * 0.9) * 0.14 + Math.cos(z * 0.09 + time * 0.7) * 0.12,
      );
    }
    position.needsUpdate = true;
  }
}
