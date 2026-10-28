import * as THREE from 'three';
import { damping, dampAngle } from '@presentation/engine/math';
import { lowPoly, solid } from '@presentation/world/materials';

/**
 * Lilo, the guide: a small round bird that flies next to the player. It never
 * blocks the view and moves slowly, so it is company, not a distraction.
 */
export class Mascot {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly wings: THREE.Mesh[] = [];
  private readonly target = new THREE.Vector3();
  motionScale = 1;

  constructor() {
    const orange = lowPoly(0xffa53d);
    const cream = lowPoly(0xfff1d6);
    this.body.add(solid(new THREE.IcosahedronGeometry(0.42, 1), orange));
    this.body.add(solid(new THREE.IcosahedronGeometry(0.3, 1), cream, [0, -0.08, 0.2]));

    for (const x of [-0.15, 0.15]) {
      this.body.add(
        solid(new THREE.IcosahedronGeometry(0.11, 1), lowPoly(0xffffff), [x, 0.1, 0.34]),
      );
      this.body.add(
        solid(new THREE.IcosahedronGeometry(0.06, 1), lowPoly(0x2d3142), [x * 1.05, 0.11, 0.43]),
      );
    }
    const beak = solid(new THREE.ConeGeometry(0.07, 0.18, 5), lowPoly(0xffd23f), [0, -0.02, 0.45]);
    beak.rotation.x = Math.PI / 2;
    this.body.add(beak);
    const tuft = solid(new THREE.ConeGeometry(0.07, 0.22, 5), orange, [0, 0.48, 0]);
    tuft.rotation.z = 0.3;
    this.body.add(tuft);

    for (const side of [-1, 1]) {
      const wing = solid(new THREE.IcosahedronGeometry(0.22, 0), orange, [side * 0.42, 0, -0.02]);
      wing.scale.set(0.5, 1, 1.2);
      this.wings.push(wing);
      this.body.add(wing);
    }
    this.root.add(this.body);
  }

  /** Hovers on the right side of the screen, slightly ahead, so it never covers the player. */
  update(time: number, dt: number, playerPosition: THREE.Vector3, cameraYaw: number): void {
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    this.target.set(
      playerPosition.x + rightX * 1.5 + forwardX * 0.8,
      playerPosition.y + 2.5 + Math.sin(time * 1.6) * 0.15 * this.motionScale,
      playerPosition.z + rightZ * 1.5 + forwardZ * 0.8,
    );
    this.root.position.lerp(this.target, damping(3, dt));
    // Looks back towards the camera, like a friend waiting for you.
    this.root.rotation.y = dampAngle(this.root.rotation.y, cameraYaw, 4, dt);

    const flap = Math.sin(time * (this.motionScale < 1 ? 5 : 9)) * 0.6;
    const [left, right] = this.wings;
    if (left !== undefined) left.rotation.z = flap;
    if (right !== undefined) right.rotation.z = -flap;
  }

  placeNear(position: THREE.Vector3): void {
    this.root.position.set(position.x + 1, position.y + 2.4, position.z);
  }
}
