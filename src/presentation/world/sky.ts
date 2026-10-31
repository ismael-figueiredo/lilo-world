import * as THREE from 'three';
import { damping } from '@presentation/engine/math';
import { skyLook, type SkyLook } from '@presentation/world/sky-looks';

const FOG_NEAR = 110;
const FOG_FAR = 340;
const STARS = 260;
const SKY_RADIUS = 800;
/** How quickly one moment of the day becomes the next. */
const CHANGE_SPEED = 1.1;
const INDOOR_LIGHT = 1.25;

/** The sky of every moment of the day. Shadows follow the player to stay sharp. */
export class Sky {
  readonly sun: THREE.DirectionalLight;
  private readonly fog: THREE.Fog;
  private readonly background: THREE.Color;
  private readonly hemisphere = new THREE.HemisphereLight(0xe4f4ff, 0xb5d99a, 1.9);
  private readonly lamps = new THREE.AmbientLight(0xffd9a8, 0);
  private readonly uniforms = {
    topColor: { value: new THREE.Color(0x3f9cf2) },
    horizonColor: { value: new THREE.Color(0xd6f1ff) },
  };
  private readonly discMaterial = new THREE.MeshBasicMaterial({ color: 0xfff6cf, fog: false });
  private readonly disc: THREE.Mesh;
  private readonly stars: THREE.Points;
  private readonly direction = new THREE.Vector3(0.55, 0.75, 0.35).normalize();
  private readonly wanted = this.direction.clone();
  private look: SkyLook = skyLook('noon', 'sunny');
  private readonly colors = {
    sun: new THREE.Color(),
    top: new THREE.Color(),
    horizon: new THREE.Color(),
    disc: new THREE.Color(),
  };
  private night = 0;
  private indoors = false;

  constructor(scene: THREE.Scene) {
    this.background = new THREE.Color(0xd6f1ff);
    scene.background = this.background;
    this.fog = new THREE.Fog(0xd6f1ff, FOG_NEAR, FOG_FAR);
    scene.fog = this.fog;

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: this.uniforms,
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

    this.disc = new THREE.Mesh(new THREE.CircleGeometry(38, 32), this.discMaterial);
    scene.add(this.disc);
    this.stars = this.createStars();
    scene.add(this.stars);
    scene.add(this.hemisphere, this.lamps);

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
    this.setLook(this.look, true);
  }

  /** The sky glides to this look. `now` jumps there at once, behind a fade. */
  setLook(look: SkyLook, now = false): void {
    this.look = look;
    this.wanted.set(...look.sun).normalize();
    this.colors.sun.setHex(look.sunColor);
    this.colors.top.setHex(look.skyTop);
    this.colors.horizon.setHex(look.horizon);
    this.colors.disc.setHex(look.disc);
    if (now) this.settle(1);
  }

  /** At dusk and at night the lamps of the house are on. */
  setIndoors(indoors: boolean): void {
    this.indoors = indoors;
  }

  /** The map is rebuilt with the new size on the next frame. */
  setShadowSize(size: number): void {
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
  }

  follow(position: THREE.Vector3, dt: number): void {
    this.settle(damping(CHANGE_SPEED, dt));
    this.sun.target.position.copy(position);
    this.sun.position.copy(position).addScaledVector(this.direction, 100);
  }

  private settle(amount: number): void {
    const { look } = this;
    this.direction.lerp(this.wanted, amount).normalize();
    this.sun.color.lerp(this.colors.sun, amount);
    this.sun.intensity += (look.sunLight - this.sun.intensity) * amount;
    this.hemisphere.intensity += (look.ambient - this.hemisphere.intensity) * amount;
    this.uniforms.topColor.value.lerp(this.colors.top, amount);
    this.uniforms.horizonColor.value.lerp(this.colors.horizon, amount);
    this.background.copy(this.uniforms.horizonColor.value);
    this.fog.color.copy(this.uniforms.horizonColor.value);
    this.discMaterial.color.lerp(this.colors.disc, amount);
    this.night += (look.night - this.night) * amount;
    (this.stars.material as THREE.PointsMaterial).opacity = this.night;
    this.stars.visible = this.night > 0.02;
    const lamps = this.indoors ? this.night * INDOOR_LIGHT : 0;
    this.lamps.intensity += (lamps - this.lamps.intensity) * amount;
    this.disc.position.copy(this.direction).multiplyScalar(SKY_RADIUS);
    this.disc.lookAt(0, 0, 0);
  }

  private createStars(): THREE.Points {
    const positions = new Float32Array(STARS * 3);
    const point = new THREE.Vector3();
    for (let i = 0; i < STARS; i += 1) {
      // Scattered evenly over the upper half of the sky, and the same every night.
      const height = (i + 0.5) / STARS;
      const angle = i * 2.399963;
      const ring = Math.sqrt(1 - height * height);
      point.set(Math.cos(angle) * ring, height, Math.sin(angle) * ring);
      point.multiplyScalar(SKY_RADIUS + 20).toArray(positions, i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 3,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        fog: false,
        depthWrite: false,
      }),
    );
    stars.frustumCulled = false;
    return stars;
  }
}
