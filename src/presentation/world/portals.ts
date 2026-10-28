import * as THREE from 'three';
import type { WorldMapEntry } from '@application/use-cases/get-world-map';
import type { WorldId } from '@domain/world/world';
import { circle, type Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import { lowPoly, solid } from '@presentation/world/materials';
import { createSign } from '@presentation/world/sign';

export const PORTAL_PLAZA = { x: 0, z: -82, radius: 16, height: 3.2 } as const;

export const portalId = (worldId: WorldId): string => `portal:${worldId}`;

interface Gate {
  readonly entry: WorldMapEntry;
  readonly group: THREE.Group;
  readonly surface: THREE.MeshBasicMaterial;
}

/** Magic gates on the hill, one per world. Locked gates show how many stars are missing. */
export class Portals {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly places: Interactable[] = [];
  private gates: Gate[] = [];

  constructor() {
    this.group.position.set(PORTAL_PLAZA.x, PORTAL_PLAZA.height, PORTAL_PLAZA.z);
    const floor = solid(
      new THREE.CylinderGeometry(PORTAL_PLAZA.radius - 2, PORTAL_PLAZA.radius - 1, 0.3, 24),
      lowPoly(0xe9e2d0),
    );
    floor.position.y = 0.05;
    this.group.add(floor);
  }

  /** Rebuilds the gates from the current map (called whenever stars change). */
  show(entries: readonly WorldMapEntry[]): void {
    for (const gate of this.gates) this.group.remove(gate.group);
    this.gates = [];
    this.colliders.length = 0;
    this.places.length = 0;

    const others = entries.filter((entry) => entry.world.id !== 'city');
    const spacing = 7;
    others.forEach((entry, index) => {
      const x = (index - (others.length - 1) / 2) * spacing;
      const z = -6 + Math.abs(x) * 0.25;
      const gate = this.createGate(entry);
      gate.group.position.set(x, 0, z);
      this.group.add(gate.group);
      this.gates.push(gate);

      const worldX = PORTAL_PLAZA.x + x;
      const worldZ = PORTAL_PLAZA.z + z;
      this.colliders.push(circle(worldX - 2.3, worldZ, 0.5), circle(worldX + 2.3, worldZ, 0.5));
      this.places.push({
        id: portalId(entry.world.id),
        position: new THREE.Vector3(worldX, PORTAL_PLAZA.height, worldZ + 2),
        markerPosition: new THREE.Vector3(worldX, PORTAL_PLAZA.height + 6.4, worldZ),
        radius: 3.2,
        icon: entry.unlocked ? '✨' : '🔒',
        label: entry.world.name,
      });
    });
  }

  update(time: number): void {
    this.gates.forEach((gate, index) => {
      gate.surface.opacity =
        (gate.entry.unlocked ? 0.75 : 0.35) + Math.sin(time * 1.5 + index) * 0.08;
    });
  }

  private createGate(entry: WorldMapEntry): Gate {
    const group = new THREE.Group();
    const color = entry.unlocked ? entry.world.color : 0xb9bcc8;
    const frame = lowPoly(color, { emissive: color, emissiveIntensity: entry.unlocked ? 0.35 : 0 });

    for (const x of [-2.3, 2.3])
      group.add(solid(new THREE.BoxGeometry(0.7, 3, 0.7), frame, [x, 1.5, 0]));
    const arch = solid(new THREE.TorusGeometry(2.3, 0.38, 8, 18, Math.PI), frame, [0, 3, 0]);
    group.add(arch);

    const outline = new THREE.Shape();
    outline.moveTo(-1.95, 0);
    outline.lineTo(-1.95, 3);
    outline.absarc(0, 3, 1.95, Math.PI, 0, true);
    outline.lineTo(1.95, 0);
    outline.closePath();
    const surface = new THREE.MeshBasicMaterial({
      color: entry.unlocked ? entry.world.color : 0x9aa0b4,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    group.add(new THREE.Mesh(new THREE.ShapeGeometry(outline, 16), surface));

    const lines = entry.unlocked
      ? [entry.world.name]
      : [entry.world.name, `🔒 ⭐ ${entry.starsMissing}`];
    const sign = createSign(lines, {
      background: entry.unlocked ? '#3fae5a' : '#6b7080',
      color: '#ffffff',
      width: 3.6,
      height: entry.unlocked ? 0.9 : 1.6,
    });
    sign.position.set(0, entry.unlocked ? 6.3 : 6.7, 0.1);
    group.add(sign);

    return { entry, group, surface };
  }
}
