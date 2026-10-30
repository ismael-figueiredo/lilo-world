import * as THREE from 'three';

const SUN_DIRECTION = new THREE.Vector3(0.55, 0.75, 0.35).normalize();
const HORIZON = 0xd6f1ff;

/** Bright, friendly daytime sky with a soft sun. Shadows follow the player to stay sharp. */
export class Sky {
  readonly sun: THREE.DirectionalLight;

  constructor(scene: THREE.Scene) {
    scene.background = new THREE.Color(HORIZON);
    scene.fog = new THREE.Fog(HORIZON, 110, 340);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          topColor: { value: new THREE.Color(0x3f9cf2) },
          horizonColor: { value: new THREE.Color(HORIZON) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vWorld = normalize((modelMatrix * vec4(position, 1.0)).xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          varying vec3 vWorld;
          void main() {
            float t = pow(max(vWorld.y, 0.0), 0.6);
            gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
          }`,
      }),
    );
    dome.renderOrder = -1;
    scene.add(dome);

    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(38, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff6cf, fog: false }),
    );
    sunDisc.position.copy(SUN_DIRECTION).multiplyScalar(800);
    sunDisc.lookAt(0, 0, 0);
    scene.add(sunDisc);

    scene.add(new THREE.HemisphereLight(0xe4f4ff, 0xb5d99a, 1.9));

    this.sun = new THREE.DirectionalLight(0xfff3df, 2.9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const area = 38;
    Object.assign(this.sun.shadow.camera, {
      left: -area,
      right: area,
      top: area,
      bottom: -area,
      near: 1,
      far: 220,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
  }

  /** The map is rebuilt with the new size on the next frame. */
  setShadowSize(size: number): void {
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
  }

  follow(position: THREE.Vector3): void {
    this.sun.target.position.copy(position);
    this.sun.position.copy(position).addScaledVector(SUN_DIRECTION, 100);
  }
}
