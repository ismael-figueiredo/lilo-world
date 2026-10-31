import * as THREE from 'three';

/** Big golden arrow over the next goal, plus a soft ring on the ground. */
export class GoalMarker {
  readonly group = new THREE.Group();
  private readonly arrow = new THREE.Group();
  private readonly ring: THREE.Mesh;
  private baseY = 0;
  private size = 1;
  motionScale = 1;

  constructor() {
    const gold = new THREE.MeshStandardMaterial({
      color: 0xffd23f,
      emissive: 0xffb800,
      emissiveIntensity: 0.6,
      flatShading: true,
    });
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.5, 6), gold);
    head.rotation.x = Math.PI;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.2, 6), gold);
    shaft.position.y = 1.2;
    this.arrow.add(head, shaft);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.8, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffd23f,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.group.add(this.arrow, this.ring);
    this.group.visible = false;
  }

  show(markerPosition: THREE.Vector3, groundPosition: THREE.Vector3): void {
    this.group.visible = true;
    this.arrow.position.copy(markerPosition);
    this.baseY = markerPosition.y;
    this.ring.position.set(groundPosition.x, groundPosition.y + 0.2, groundPosition.z);
  }

  /** Smaller inside the house, where a street-sized arrow would hide the rooms. */
  setSize(size: number): void {
    this.size = size;
    this.arrow.scale.setScalar(size);
  }

  hide(): void {
    this.group.visible = false;
  }

  update(time: number): void {
    if (!this.group.visible) return;
    this.arrow.position.y = this.baseY + Math.sin(time * 2.2) * 0.35 * this.motionScale;
    this.arrow.rotation.y = time * 1.2 * this.motionScale;
    const pulse = (1 + Math.sin(time * 2.2) * 0.12 * this.motionScale) * this.size;
    this.ring.scale.set(pulse, pulse, pulse);
  }
}
