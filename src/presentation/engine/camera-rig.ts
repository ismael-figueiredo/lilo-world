import * as THREE from 'three';
import { clamp, damping } from '@presentation/engine/math';

const MIN_PITCH = 0.12;
const MAX_PITCH = 0.95;
const INDOOR_PITCH = 0.92;
const INDOOR_DISTANCE = 10;

/**
 * Third-person camera that follows the player smoothly (no shakes, no sudden
 * cuts) and can glide to a fixed view for missions and the wardrobe.
 */
export class CameraRig {
  yaw = 0;
  pitch = 0.38;
  distance = 7.5;
  /** Multiplier from the comfort settings (slow / normal / fast camera). */
  sensitivity = 1;

  private readonly target = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private focus: { position: THREE.Vector3; lookAt: THREE.Vector3 } | null = null;
  private outdoors: { yaw: number; pitch: number; distance: number } | null = null;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly groundAt: (x: number, z: number) => number,
    /** 0..1 along target → camera where a wall is hit (1 = clear view). */
    private readonly obstruction: (from: THREE.Vector3, to: THREE.Vector3) => number = () => 1,
  ) {}

  /**
   * Inside the house the camera stays high on the side of the low walls: it
   * follows the child, does not turn and so never goes through a wall.
   */
  setIndoors(indoors: boolean): void {
    if (indoors === (this.outdoors !== null)) return;
    if (indoors) {
      this.outdoors = { yaw: this.yaw, pitch: this.pitch, distance: this.distance };
      this.yaw = 0;
      this.pitch = INDOOR_PITCH;
      this.distance = INDOOR_DISTANCE;
    } else if (this.outdoors !== null) {
      Object.assign(this, this.outdoors);
      this.outdoors = null;
    }
  }

  rotate(dx: number, dy: number): void {
    if (this.outdoors !== null) return;
    this.yaw -= dx * 0.006 * this.sensitivity;
    this.pitch = clamp(this.pitch + dy * 0.004 * this.sensitivity, MIN_PITCH, MAX_PITCH);
  }

  /** Jumps straight to the follow position (used at start). */
  snapTo(follow: THREE.Vector3): void {
    this.target.copy(follow).y += 1.3;
    this.lookTarget.copy(this.target);
    this.camera.position.copy(this.orbitPosition(this.desired));
    this.camera.lookAt(this.lookTarget);
  }

  /** Glides to a fixed view; `snap` jumps there at once (only behind a fade). */
  setFocus(position: THREE.Vector3, lookAt: THREE.Vector3, snap = false): void {
    this.focus = { position: position.clone(), lookAt: lookAt.clone() };
    if (snap) {
      this.camera.position.copy(position);
      this.lookTarget.copy(lookAt);
      this.camera.lookAt(this.lookTarget);
    }
  }

  /** Skips the glide to the current view (only behind a fade). */
  snap(): void {
    if (this.focus === null) return;
    this.camera.position.copy(this.focus.position);
    this.lookTarget.copy(this.focus.lookAt);
    this.camera.lookAt(this.lookTarget);
  }

  get isFocused(): boolean {
    return this.focus !== null;
  }

  clearFocus(): void {
    this.focus = null;
  }

  update(dt: number, follow: THREE.Vector3): void {
    if (this.focus !== null) {
      this.camera.position.lerp(this.focus.position, damping(4, dt));
      this.lookTarget.lerp(this.focus.lookAt, damping(5, dt));
      this.camera.lookAt(this.lookTarget);
      return;
    }

    this.desired.copy(follow);
    this.desired.y += 1.3;
    this.target.lerp(this.desired, damping(10, dt));

    const position = this.orbitPosition(this.desired);
    const floor = this.groundAt(position.x, position.z) + 0.8;
    if (position.y < floor) position.y = floor;

    // Slide in front of walls instead of looking through them.
    const clear = this.outdoors === null ? this.obstruction(this.target, position) : 1;
    if (clear < 1) position.lerpVectors(this.target, position, Math.max(0.12, clear - 0.04));
    this.camera.position.lerp(position, damping(clear < 1 ? 20 : 8, dt));
    this.lookTarget.lerp(this.target, damping(12, dt));
    this.camera.lookAt(this.lookTarget);
  }

  private orbitPosition(out: THREE.Vector3): THREE.Vector3 {
    const horizontal = Math.cos(this.pitch) * this.distance;
    return out.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
  }
}
