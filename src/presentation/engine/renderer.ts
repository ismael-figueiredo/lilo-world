import * as THREE from 'three';

/** Renderer tuned for tablets: capped pixel ratio, soft shadows, vivid (neutral) tone mapping. */
export function createRenderer(container: HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.classList.add('game-canvas');
  container.appendChild(renderer.domElement);
  return renderer;
}

export function fitToContainer(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  container: HTMLElement,
): void {
  const width = container.clientWidth;
  const height = container.clientHeight;
  renderer.setSize(width, height);
  camera.aspect = width / Math.max(1, height);
  // Portrait screens see more of the world vertically instead of zooming in.
  camera.fov = camera.aspect < 1 ? 70 : 55;
  camera.updateProjectionMatrix();
}
