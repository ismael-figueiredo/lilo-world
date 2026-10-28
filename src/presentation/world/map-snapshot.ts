import * as THREE from 'three';
import { MAP_EXTENT } from '@presentation/world/map-projection';

/**
 * Renders the island once from above into a square picture for the map.
 * Call it while the start screen covers the game, so the frame is never seen.
 */
export function captureMap(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  hide: readonly THREE.Object3D[],
  setClouds: (visible: boolean) => void,
  size = 768,
): HTMLCanvasElement {
  const source = renderer.domElement;
  const aspect = source.width / Math.max(1, source.height);
  const halfWidth = aspect >= 1 ? MAP_EXTENT * aspect : MAP_EXTENT;
  const halfHeight = aspect >= 1 ? MAP_EXTENT : MAP_EXTENT / aspect;
  const camera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    1,
    900,
  );
  camera.position.set(0, 400, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);

  const visibility = hide.map((object) => object.visible);
  for (const object of hide) object.visible = false;
  const fog = scene.fog;
  scene.fog = null;
  setClouds(false);

  renderer.render(scene, camera);

  const picture = document.createElement('canvas');
  picture.width = size;
  picture.height = size;
  const side = Math.min(source.width, source.height);
  picture
    .getContext('2d')
    ?.drawImage(
      source,
      (source.width - side) / 2,
      (source.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );

  hide.forEach((object, index) => {
    object.visible = visibility[index] ?? true;
  });
  scene.fog = fog;
  setClouds(true);
  return picture;
}
