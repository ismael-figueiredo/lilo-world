import * as THREE from 'three';
import type { Weather } from '@domain/day/weather';

const AREA = 14;
const HEIGHT = 12;
const RAIN_DROPS = 420;
const LEAVES = 36;
const FALL_SPEED = 22;
/** A calm setting keeps the rain, falling gently: the weather must not disappear. */
const CALM_FALL = 0.15;
const BREATH_EVERY = 2.2;
const BREATH_LIFE = 0.9;
const BELOW_GROUND = -100;
const NEAR_EYE = 4;

const wrap = (value: number, center: number, half: number): number => {
  const size = half * 2;
  return ((((value - center + half) % size) + size) % size) + center - half;
};

const scatter = (count: number, seed: number): Float32Array => {
  const values = new Float32Array(count);
  let state = seed;
  for (let i = 0; i < count; i += 1) {
    state = (state * 16807) % 2147483647;
    values[i] = state / 2147483647;
  }
  return values;
};

/** A rectangle of the ground with a roof over it. */
export interface DryArea {
  readonly x: number;
  readonly z: number;
  readonly halfX: number;
  readonly halfZ: number;
}

const covers = (area: DryArea | undefined, x: number, z: number): boolean =>
  area !== undefined && Math.abs(x - area.x) < area.halfX && Math.abs(z - area.z) < area.halfZ;

/**
 * Rain, leaves in the wind and breath in the cold, close to the child: only
 * what the camera can see exists. Inside the house the weather goes on around
 * it and stops at the walls. A calm child setting turns off the leaves and
 * slows the rain.
 */
export class WeatherEffects {
  readonly group = new THREE.Group();
  private readonly rain: THREE.InstancedMesh;
  private readonly drop = new THREE.Matrix4();
  private readonly gone = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly leaves: THREE.Points;
  private readonly leafPositions: Float32Array;
  private readonly offsets = scatter(RAIN_DROPS * 3 + LEAVES * 3, 48271);
  private readonly breath: THREE.Mesh;
  private weather: Weather = 'sunny';
  private moving = true;
  private dry: DryArea | undefined;
  private breathAge = 0;

  constructor() {
    // Thin boxes and not lines: a line of one pixel disappears on a tablet's screen.
    this.rain = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.055, 1, 0.055).rotateZ(0.06),
      new THREE.MeshBasicMaterial({ color: 0xdcebfa, transparent: true, opacity: 0.5 }),
      RAIN_DROPS,
    );
    this.rain.frustumCulled = false;

    this.leafPositions = new Float32Array(LEAVES * 3);
    const leafGeometry = new THREE.BufferGeometry();
    leafGeometry.setAttribute('position', new THREE.BufferAttribute(this.leafPositions, 3));
    this.leaves = new THREE.Points(
      leafGeometry,
      new THREE.PointsMaterial({ color: 0x7fae4e, size: 0.22, transparent: true }),
    );
    this.leaves.frustumCulled = false;

    this.breath = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.09, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }),
    );
    this.group.add(this.rain, this.leaves, this.breath);
    this.show();
  }

  setWeather(weather: Weather): void {
    this.weather = weather;
    this.show();
  }

  setMoving(moving: boolean): void {
    this.moving = moving;
    this.show();
  }

  /** Where nothing falls: the house, while the child is in it. */
  setDry(area: DryArea | undefined): void {
    this.dry = area;
  }

  /** `face` is where the breath of the child comes from. */
  update(
    time: number,
    dt: number,
    focus: THREE.Vector3,
    face: THREE.Vector3,
    eye: THREE.Vector3,
  ): void {
    if (this.rain.visible) this.fall(time, focus, eye);
    if (this.leaves.visible) this.blow(time, focus);
    if (this.weather === 'cold' && this.moving && this.dry === undefined) this.breathe(dt, face);
  }

  private show(): void {
    this.rain.visible = this.weather === 'rain';
    this.leaves.visible = this.moving && this.weather === 'wind';
    this.breath.visible = false;
  }

  private fall(time: number, focus: THREE.Vector3, eye: THREE.Vector3): void {
    const fallen = time * FALL_SPEED * (this.moving ? 1 : CALM_FALL);
    for (let i = 0; i < RAIN_DROPS; i += 1) {
      const x = wrap((this.offsets[i * 3] ?? 0) * AREA * 2, focus.x, AREA);
      const z = wrap((this.offsets[i * 3 + 1] ?? 0) * AREA * 2, focus.z, AREA);
      const start = (this.offsets[i * 3 + 2] ?? 0) * HEIGHT;
      const y = focus.y + wrap(start - fallen, HEIGHT / 2, HEIGHT / 2);
      // A drop against the lens would look like a white column across the screen.
      const atEye = Math.hypot(x - eye.x, z - eye.z) < NEAR_EYE;
      const hidden = atEye || covers(this.dry, x, z);
      const matrix = hidden ? this.gone : this.drop.makeTranslation(x, y, z);
      this.rain.setMatrixAt(i, matrix);
    }
    this.rain.instanceMatrix.needsUpdate = true;
  }

  private blow(time: number, focus: THREE.Vector3): void {
    const positions = this.leafPositions;
    const first = RAIN_DROPS * 3;
    for (let i = 0; i < LEAVES; i += 1) {
      const a = this.offsets[first + i * 3] ?? 0;
      const b = this.offsets[first + i * 3 + 1] ?? 0;
      const c = this.offsets[first + i * 3 + 2] ?? 0;
      const x = wrap(a * AREA * 2 + time * (5 + b * 4), focus.x, AREA);
      const z = wrap(b * AREA * 2 + Math.sin(time + c * 6) * 2, focus.z, AREA);
      positions[i * 3] = x;
      positions[i * 3 + 1] = covers(this.dry, x, z)
        ? BELOW_GROUND
        : focus.y + 0.4 + c * 5 + Math.sin(time * 2 + a * 9) * 0.5;
      positions[i * 3 + 2] = z;
    }
    (this.leaves.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private breathe(dt: number, face: THREE.Vector3): void {
    this.breathAge += dt;
    if (this.breathAge > BREATH_EVERY) {
      this.breathAge = 0;
      this.breath.position.copy(face);
    }
    const age = this.breathAge / BREATH_LIFE;
    this.breath.visible = age < 1;
    if (!this.breath.visible) return;
    this.breath.position.y += dt * 0.2;
    this.breath.scale.setScalar(1 + age * 2.5);
    (this.breath.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - age);
  }
}
