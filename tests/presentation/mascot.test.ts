import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Mascot } from '@presentation/actors/mascot';

const FRAME = 1 / 30;

function fly(mascot: Mascot, player: THREE.Vector3, yaw: number): void {
  for (let frame = 0; frame < 300; frame += 1) {
    mascot.update(frame * FRAME, FRAME, player, yaw);
  }
}

describe('Lilo, the guide', () => {
  const cabin = new THREE.Box3(new THREE.Vector3(-4, 1, -1), new THREE.Vector3(4, 2, 1));
  const child = new THREE.Vector3(3.5, 0, 0.8);

  it('flies high and to the side in the open', () => {
    const mascot = new Mascot();
    fly(mascot, child, 0);
    expect(mascot.root.position.y).toBeGreaterThan(2);
    expect(mascot.root.position.x).toBeGreaterThan(4);
  });

  it('stays inside a low cabin wherever the camera turns', () => {
    const mascot = new Mascot();
    mascot.flyWithin(cabin);
    mascot.placeNear(child);
    expect(cabin.containsPoint(mascot.root.position)).toBe(true);
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      fly(mascot, child, yaw);
      expect(cabin.containsPoint(mascot.root.position)).toBe(true);
    }
  });

  it('is free again when the cabin is left', () => {
    const mascot = new Mascot();
    mascot.flyWithin(cabin);
    fly(mascot, child, 0);
    mascot.flyWithin(undefined);
    fly(mascot, child, 0);
    expect(mascot.root.position.y).toBeGreaterThan(2);
  });
});
