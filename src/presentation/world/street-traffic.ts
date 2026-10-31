import * as THREE from 'three';
import type { TrafficPhase } from '@domain/city/traffic-light';
import {
  distanceAlong,
  makeRoute,
  positionAt,
  wrap,
  type Point,
  type Route,
} from '@domain/city/route';
import { stepCar, type Car, type StopLine } from '@domain/city/traffic';
import type { CircleCollider } from '@presentation/world/collision';
import { crossingRect, type Crossing, type Rect } from '@presentation/world/street-plan';
import { CAR_LOOP, CROSSINGS } from '@presentation/world/street-layout';
import type { WorldAssets, WorldModelId } from '@presentation/world/world-assets';

const MODELS: readonly WorldModelId[] = ['car', 'taxi', 'suv', 'car'];
const CALM_CARS = 1;
const LOOP_STARTS = [0.02, 0.27, 0.52, 0.77];
const LINE_BEFORE = 0.4;
/** How far from a crosswalk someone already counts as about to cross. */
const CURB = 1.3;
const PART_RADIUS = 1.05;
const PART_OFFSET = 1.15;
/** Asks to cross: no car this close to the crossing. */
const CLEAR_TO_CROSS = 11;
/** Where the solid shape of a resting car waits: nobody can bump into it. */
const AWAY = 1e6;

type MutableCircle = { -readonly [K in keyof CircleCollider]: CircleCollider[K] };

interface Moving {
  readonly model: THREE.Object3D;
  readonly parts: readonly MutableCircle[];
  state: Car;
}

interface Line {
  readonly crossing: Crossing;
  readonly rect: Rect;
  readonly at: number;
  readonly center: number;
}

const isNear = ({ x, z, width, depth }: Rect, across: 'x' | 'z', point: Point): boolean => {
  const marginX = across === 'x' ? CURB : 0.3;
  const marginZ = across === 'z' ? CURB : 0.3;
  return (
    Math.abs(point.x - x) <= width / 2 + marginX && Math.abs(point.z - z) <= depth / 2 + marginZ
  );
};

function linesOf(route: Route): Line[] {
  return CROSSINGS.filter(({ road }) => {
    const rect = crossingRect({ road, at: 0, width: 1 });
    return road.axis === 'x' ? rect.z >= 0 : rect.x !== 0;
  }).map((crossing) => {
    const rect = crossingRect(crossing);
    const center = distanceAlong(route, rect);
    return {
      crossing,
      rect,
      center,
      at: wrap(route, center - crossing.width / 2 - LINE_BEFORE),
    };
  });
}

/** Cars going around the blocks. They yield to everybody, and nobody can be hit. */
export class StreetTraffic {
  readonly group = new THREE.Group();
  private readonly route = makeRoute(CAR_LOOP);
  private readonly lines = linesOf(this.route);
  private readonly cars: readonly Moving[];
  private calm = false;

  constructor(assets: WorldAssets) {
    this.cars = MODELS.map((id, index) => {
      const model = assets.clone(id, id === 'car' && index === 0 ? { Blue: 0x3fae5a } : {});
      model.scale.setScalar(1.1);
      this.group.add(model);
      return {
        model,
        parts: [-1, 1].map((): MutableCircle => ({ kind: 'circle', x: AWAY, z: AWAY, radius: 0 })),
        state: { distance: this.route.length * (LOOP_STARTS[index] ?? 0), speed: 0 },
      };
    });
  }

  /** Moving solid shapes. */
  get colliders(): readonly CircleCollider[] {
    return this.cars.flatMap((car) => car.parts);
  }

  /** The calm town has one car; the others wait out of sight. */
  setCalm(calm: boolean): void {
    this.calm = calm;
    this.active().forEach((car) => {
      car.model.visible = true;
    });
    this.cars.slice(this.active().length).forEach((car) => {
      car.model.visible = false;
      for (const part of car.parts) part.x = AWAY;
    });
  }

  private active(): readonly Moving[] {
    return this.calm ? this.cars.slice(0, CALM_CARS) : this.cars;
  }

  /** May someone start crossing here now? */
  mayCross(spot: Point, phase: TrafficPhase): boolean {
    const line = this.lines.find(({ rect, crossing }) =>
      isNear(rect, crossing.road.axis === 'x' ? 'z' : 'x', spot),
    );
    if (line === undefined) return true;
    if (line.crossing.signal === true) return phase.walk;
    return this.active().every(
      ({ state }) => wrap(this.route, line.center - state.distance) > CLEAR_TO_CROSS,
    );
  }

  /** From 0, the street is far, to 1, a car is right here. */
  closeness(point: Point): number {
    const nearest = Math.min(
      ...this.active().map(({ model }) =>
        Math.hypot(model.position.x - point.x, model.position.z - point.z),
      ),
    );
    return Math.max(0, 1 - nearest / 22);
  }

  update(dt: number, phase: TrafficPhase, people: readonly Point[]): void {
    const stops = this.lines.map(({ at, crossing, rect }): StopLine => {
      const across = crossing.road.axis === 'x' ? 'z' : 'x';
      const walking = people.some((person) => isNear(rect, across, person));
      if (crossing.signal !== true) return { at, closed: walking };
      return {
        at,
        closed: phase.cars !== 'green' || walking,
        ...(phase.cars === 'yellow' && !walking ? { lateCarsPass: true } : {}),
      };
    });
    const active = this.active();
    for (const car of active) {
      car.state = stepCar(
        car.state,
        {
          route: this.route,
          lines: stops,
          people,
          others: active.filter((other) => other !== car).map((other) => other.state.distance),
        },
        dt,
      );
      this.show(car);
    }
  }

  private show(car: Moving): void {
    const { x, z, heading } = positionAt(this.route, car.state.distance);
    car.model.position.set(x, 0.08, z);
    // Turns are drawn a little behind the math, or the car would snap at each corner.
    const turn = Math.atan2(
      Math.sin(heading - car.model.rotation.y),
      Math.cos(heading - car.model.rotation.y),
    );
    car.model.rotation.y += turn * 0.12;
    car.parts.forEach((part, index) => {
      const side = index === 0 ? -1 : 1;
      part.x = x + Math.sin(heading) * PART_OFFSET * side;
      part.z = z + Math.cos(heading) * PART_OFFSET * side;
      part.radius = PART_RADIUS;
    });
  }
}
