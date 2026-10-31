import * as THREE from 'three';

/** Far enough for the goal to be out of sight. */
const SHOW_BEYOND = 7;
const AT_FEET = 1.5;

/** An arrow on the ground beside the child, always pointing to where they are going. */
export class GuideArrow {
  readonly group = new THREE.Group();

  constructor() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.55);
    shape.lineTo(0.5, -0.2);
    shape.lineTo(0, -0.02);
    shape.lineTo(-0.5, -0.2);
    shape.closePath();
    const arrow = new THREE.Mesh(
      new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xffc72e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
    );
    arrow.position.z = AT_FEET;
    arrow.scale.setScalar(1.5);
    this.group.add(arrow);
    this.group.visible = false;
  }

  /** Follows the child. Without a goal, or next to it, there is nothing to show. */
  update(from: THREE.Vector3, goal: THREE.Vector3 | undefined): void {
    const dx = (goal?.x ?? from.x) - from.x;
    const dz = (goal?.z ?? from.z) - from.z;
    this.group.visible = goal !== undefined && Math.hypot(dx, dz) > SHOW_BEYOND;
    if (!this.group.visible) return;
    this.group.position.set(from.x, from.y + 0.22, from.z);
    this.group.rotation.y = Math.atan2(dx, dz);
  }

  hide(): void {
    this.group.visible = false;
  }
}
