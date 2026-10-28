import * as THREE from 'three';
import type { Random } from '@presentation/engine/math';
import { WATER_LEVEL, type TerrainShape } from '@presentation/world/terrain-shape';

const palette = {
  seabed: new THREE.Color(0xd8c48c),
  sand: new THREE.Color(0xf4dfa0),
  grass: [new THREE.Color(0x7fd35b), new THREE.Color(0x6cc24f), new THREE.Color(0x8fdc66)],
  meadow: new THREE.Color(0xa6e070),
  rock: new THREE.Color(0xa3a196),
};

/** Faceted island ground: every triangle gets one color, like a toy diorama. */
export function createTerrainMesh(
  shape: TerrainShape,
  random: Random,
  size = 340,
  segments = 170,
): THREE.Mesh {
  const grid = new THREE.PlaneGeometry(size, size, segments, segments);
  grid.rotateX(-Math.PI / 2);
  const positions = grid.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i += 1) {
    positions.setY(i, shape.heightAt(positions.getX(i), positions.getZ(i)));
  }

  const geometry = grid.toNonIndexed();
  grid.dispose();
  geometry.computeVertexNormals();

  const position = geometry.attributes.position as THREE.BufferAttribute;
  const normal = geometry.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();

  for (let face = 0; face < position.count; face += 3) {
    const height = (position.getY(face) + position.getY(face + 1) + position.getY(face + 2)) / 3;
    const flatness = normal.getY(face);

    if (height < WATER_LEVEL - 0.4) color.copy(palette.seabed);
    else if (height < WATER_LEVEL + 0.9) color.copy(palette.sand);
    else if (flatness < 0.78) color.copy(palette.rock);
    else if (height > 7.5) color.copy(palette.meadow);
    else color.copy(palette.grass[Math.floor(random() * palette.grass.length)] ?? palette.meadow);

    color.offsetHSL(0, 0, (random() - 0.5) * 0.04);
    for (let v = 0; v < 3; v += 1) color.toArray(colors, (face + v) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}
