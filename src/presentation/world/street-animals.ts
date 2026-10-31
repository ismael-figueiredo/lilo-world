import * as THREE from 'three';
import { pigeonOnTheGround, stepPigeon, type Pigeon } from '@domain/city/pigeon';
import { makeRoute, positionAt, type Point } from '@domain/city/route';
import { lowPoly, solid } from '@presentation/world/materials';
import { mergeStatic } from '@presentation/world/merge-static';

const FLOCK = 10;
const CALM_FLOCK = 4;
const PIGEONS = 7;
const FLOCK_HEIGHT = 16;
const DOG_SPEED = 1.3;
/** The dog stops to look at the child who comes close. */
const DOG_NOTICE = 3.5;

const birdShape = (): THREE.BufferGeometry => {
  const body = new THREE.ConeGeometry(0.1, 0.5, 5).rotateX(Math.PI / 2);
  const wing = new THREE.BoxGeometry(0.9, 0.02, 0.22);
  const shapes = [body.toNonIndexed(), wing.toNonIndexed()];
  const positions = shapes.flatMap((shape) => [
    ...(shape.getAttribute('position').array as Float32Array),
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

function dog(): THREE.Object3D {
  const group = new THREE.Group();
  const coat = lowPoly(0xc08a4e);
  const dark = lowPoly(0x7a5230);
  group.add(
    solid(new THREE.BoxGeometry(0.28, 0.26, 0.62), coat, [0, 0.36, 0]),
    solid(new THREE.BoxGeometry(0.26, 0.24, 0.26), coat, [0, 0.54, 0.38]),
    solid(new THREE.BoxGeometry(0.14, 0.1, 0.14), dark, [0, 0.5, 0.56]),
    solid(new THREE.BoxGeometry(0.06, 0.16, 0.08), dark, [-0.14, 0.62, 0.34]),
    solid(new THREE.BoxGeometry(0.06, 0.16, 0.08), dark, [0.14, 0.62, 0.34]),
  );
  for (const [x, z] of [
    [-0.1, 0.22],
    [0.1, 0.22],
    [-0.1, -0.22],
    [0.1, -0.22],
  ] as const) {
    group.add(solid(new THREE.BoxGeometry(0.08, 0.26, 0.08), coat, [x, 0.13, z]));
  }
  return group;
}

function cat(): THREE.Object3D {
  const group = new THREE.Group();
  const coat = lowPoly(0x8a8f99);
  group.add(
    solid(new THREE.BoxGeometry(0.22, 0.3, 0.3), coat, [0, 0.15, 0]),
    solid(new THREE.BoxGeometry(0.22, 0.2, 0.2), coat, [0, 0.36, 0.08]),
    solid(new THREE.ConeGeometry(0.05, 0.1, 4), coat, [-0.07, 0.5, 0.08]),
    solid(new THREE.ConeGeometry(0.05, 0.1, 4), coat, [0.07, 0.5, 0.08]),
    solid(new THREE.BoxGeometry(0.05, 0.05, 0.34), coat, [0.08, 0.03, -0.26]),
  );
  return group;
}

const tail = (color: number): THREE.Mesh =>
  solid(new THREE.BoxGeometry(0.05, 0.05, 0.28), lowPoly(color));

/** Small lives of the town, cheap enough to always be there. */
export class StreetAnimals {
  readonly group = new THREE.Group();
  private readonly flock: THREE.InstancedMesh;
  private readonly pigeons: THREE.InstancedMesh;
  private readonly pigeonSpots: readonly Point[];
  private pigeonStates: Pigeon[];
  private readonly dog = dog();
  private readonly dogTail = tail(0x7a5230);
  private readonly dogRoute;
  private dogDistance = 0;
  private readonly spot = new THREE.Object3D();
  private flockSize = FLOCK;
  private asleep = false;
  private calmMotion = 1;

  constructor(pigeonsAround: Point, dogWalk: readonly Point[], catSeat: Point) {
    const shape = birdShape();
    this.flock = new THREE.InstancedMesh(shape, lowPoly(0x3d4452), FLOCK);
    this.flock.frustumCulled = false;
    this.pigeons = new THREE.InstancedMesh(shape, lowPoly(0x8d97a8), PIGEONS);
    this.pigeons.frustumCulled = false;
    this.pigeonSpots = Array.from({ length: PIGEONS }, (_, index) => {
      const angle = index * 2.4;
      const radius = 1.2 + (index % 3) * 0.9;
      return {
        x: pigeonsAround.x + Math.cos(angle) * radius,
        z: pigeonsAround.z + Math.sin(angle) * radius,
      };
    });
    this.pigeonStates = this.pigeonSpots.map(() => pigeonOnTheGround);
    this.dogRoute = makeRoute(dogWalk);
    this.dogTail.position.set(0, 0.46, -0.42);
    this.dog.add(this.dogTail);
    const seated = cat();
    seated.position.set(catSeat.x, 0.16, catSeat.z);
    seated.rotation.y = 2.4;
    this.group.add(this.flock, this.pigeons, this.dog, seated);
    mergeStatic(this.group, [this.flock, this.pigeons, this.dog]);
  }

  /** Fewer birds in the calm town. */
  setCalm(calm: boolean): void {
    this.flockSize = calm ? CALM_FLOCK : FLOCK;
    this.flock.count = this.flockSize;
    this.calmMotion = calm ? 0.6 : 1;
  }

  /** Birds and pigeons sleep at night. */
  setNight(night: boolean): void {
    this.asleep = night;
    this.flock.visible = !night;
    this.pigeons.visible = !night;
  }

  update(time: number, dt: number, child: Point): void {
    if (!this.asleep) {
      this.updateFlock(time);
      this.updatePigeons(time, dt, child);
    }
    this.updateDog(time, dt, child);
  }

  private updateFlock(time: number): void {
    const { spot } = this;
    for (let index = 0; index < this.flockSize; index += 1) {
      const angle = time * 0.16 * this.calmMotion + index * 0.26;
      const radius = 30 + (index % 3) * 2.5;
      spot.position.set(
        Math.cos(angle) * radius,
        FLOCK_HEIGHT + Math.sin(index * 1.7) * 1.2,
        12 + Math.sin(angle) * radius,
      );
      spot.rotation.set(0, -angle + Math.PI, 0);
      spot.scale.set(1, 1 + Math.sin(time * 7 + index) * 0.5, 1);
      spot.updateMatrix();
      this.flock.setMatrixAt(index, spot.matrix);
    }
    this.flock.instanceMatrix.needsUpdate = true;
  }

  private updatePigeons(time: number, dt: number, child: Point): void {
    const { spot } = this;
    this.pigeonStates = this.pigeonStates.map((pigeon, index) => {
      const place = this.pigeonSpots[index] ?? child;
      const away = Math.hypot(place.x - child.x, place.z - child.z);
      const next = stepPigeon(pigeon, away, dt);
      const flying = next.height > 0;
      spot.position.set(place.x, 0.18 + next.height, place.z);
      spot.rotation.set(0, index * 1.9, 0);
      // On the ground the wings are folded; in the air they beat.
      const beat = flying ? 1 + Math.sin(time * 14 + index) * 0.6 : 1;
      const wings = flying ? 0.9 : 0.5;
      spot.scale.set(wings, beat * 2.2, 1.2);
      spot.updateMatrix();
      this.pigeons.setMatrixAt(index, spot.matrix);
      return next;
    });
    this.pigeons.instanceMatrix.needsUpdate = true;
  }

  private updateDog(time: number, dt: number, child: Point): void {
    const { x, z } = this.dog.position;
    const near = Math.hypot(child.x - x, child.z - z) < DOG_NOTICE;
    if (!near) this.dogDistance += DOG_SPEED * dt;
    const place = positionAt(this.dogRoute, this.dogDistance);
    this.dog.position.set(place.x, 0.14, place.z);
    this.dog.rotation.y = near ? Math.atan2(child.x - x, child.z - z) : place.heading;
    this.dogTail.rotation.y = Math.sin(time * (near ? 16 : 7)) * 0.6;
  }
}
