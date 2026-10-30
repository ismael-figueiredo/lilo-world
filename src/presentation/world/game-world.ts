import * as THREE from 'three';
import type { TrafficPhase } from '@domain/city/traffic-light';
import type { WorldMapEntry } from '@application/use-cases/get-world-map';
import type { Random } from '@presentation/engine/math';
import { CITY, City, isInsideCity, SOUTH_DISTRICT } from '@presentation/world/city';
import type { Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import { lowPoly } from '@presentation/world/materials';
import { Nature } from '@presentation/world/nature';
import { EMOTIONS_GARDEN, EmotionsGarden } from '@presentation/world/emotions-garden';
import { HOME_AREA, HomeArea } from '@presentation/world/home-area';
import { MARKET_INTERIOR, MarketInterior } from '@presentation/world/market-interior';
import { NATURE_CAMP, NatureCamp } from '@presentation/world/nature-camp';
import { SCHOOL_AREA, SchoolArea } from '@presentation/world/school-area';
import { PORTAL_PLAZA, Portals } from '@presentation/world/portals';
import { Sky } from '@presentation/world/sky';
import { createTerrainMesh } from '@presentation/world/terrain-mesh';
import { defaultTerrainOptions, TerrainShape } from '@presentation/world/terrain-shape';
import { Water } from '@presentation/world/water';
import type { WorldAssets } from '@presentation/world/world-assets';

/** Path of stones from the side street up to the portal hill. */
const PATH = { fromZ: -CITY.radius + 2, toZ: PORTAL_PLAZA.z + PORTAL_PLAZA.radius - 2 } as const;

/** The whole open world: island, sea, sky, nature, city and portals. */
export class GameWorld {
  readonly shape: TerrainShape;
  readonly sky: Sky;
  readonly spawn = new THREE.Vector3(-14, CITY.height, 4.6);
  /** Camera starts behind the player, looking straight down the street to the market. */
  readonly spawnYaw = -Math.PI / 2;
  colliders: readonly Collider[] = [];
  places: readonly Interactable[] = [];

  private readonly water = new Water();
  private readonly city: City;
  private readonly camp: NatureCamp;
  private readonly home: HomeArea;
  private readonly school: SchoolArea;
  private readonly emotions: EmotionsGarden;
  /** Inside the market, far beyond the sea. */
  readonly market: MarketInterior;
  private readonly portals = new Portals();
  private readonly nature: Nature;
  private readonly staticColliders: Collider[];

  constructor(scene: THREE.Scene, random: Random, assets: WorldAssets) {
    this.city = new City(assets);
    this.camp = new NatureCamp(assets);
    this.home = new HomeArea(assets);
    this.school = new SchoolArea(assets);
    this.emotions = new EmotionsGarden(assets);
    this.shape = new TerrainShape(random, {
      ...defaultTerrainOptions,
      flatAreas: [
        { x: CITY.x, z: CITY.z, radius: CITY.radius, height: CITY.height, blend: 14 },
        { ...SOUTH_DISTRICT, height: CITY.height, blend: 12 },
        { ...NATURE_CAMP, blend: 10 },
        { ...HOME_AREA, blend: 10 },
        { ...SCHOOL_AREA, blend: 10 },
        { ...EMOTIONS_GARDEN, blend: 10 },
        { ...PORTAL_PLAZA, blend: 10 },
      ],
    });
    this.sky = new Sky(scene);
    this.market = new MarketInterior(this.shape.heightAt(MARKET_INTERIOR.x, MARKET_INTERIOR.z));

    scene.add(createTerrainMesh(this.shape, random));
    scene.add(
      this.water.mesh,
      this.city.group,
      this.portals.group,
      this.camp.group,
      this.home.group,
      this.school.group,
      this.emotions.group,
      this.market.group,
    );
    this.addPath(scene);

    this.nature = new Nature(this.shape, random, assets, {
      keepClear: (x, z) =>
        isInsideCity(x, z, 3) ||
        Math.hypot(x - NATURE_CAMP.x, z - NATURE_CAMP.z) < NATURE_CAMP.radius + 2 ||
        Math.hypot(x - HOME_AREA.x, z - HOME_AREA.z) < HOME_AREA.radius + 2 ||
        Math.hypot(x - SCHOOL_AREA.x, z - SCHOOL_AREA.z) < SCHOOL_AREA.radius + 2 ||
        Math.hypot(x - EMOTIONS_GARDEN.x, z - EMOTIONS_GARDEN.z) < EMOTIONS_GARDEN.radius + 2 ||
        Math.hypot(x - PORTAL_PLAZA.x, z - PORTAL_PLAZA.z) < PORTAL_PLAZA.radius + 3 ||
        (Math.abs(x) < 5 && z < PATH.fromZ + 4 && z > PATH.toZ - 4),
    });
    scene.add(this.nature.group);
    this.staticColliders = [
      ...this.city.colliders,
      ...this.camp.colliders,
      ...this.home.colliders,
      ...this.school.colliders,
      ...this.emotions.colliders,
      ...this.nature.colliders,
    ];
    this.colliders = this.staticColliders;
    this.places = [
      ...this.city.places,
      ...this.camp.places,
      ...this.home.places,
      ...this.school.places,
      ...this.emotions.places,
    ];
  }

  /** The traffic light cycle shared by the whole town. */
  get trafficPhase(): TrafficPhase {
    return this.city.phase;
  }

  heightAt(x: number, z: number): number {
    return this.shape.heightAt(x, z);
  }

  isWalkable(x: number, z: number): boolean {
    return this.shape.isWalkable(x, z);
  }

  setMotionScale(scale: number): void {
    this.water.motionScale = scale;
  }

  setCloudsVisible(visible: boolean): void {
    this.nature.setCloudsVisible(visible);
  }

  showWorlds(entries: readonly WorldMapEntry[]): void {
    this.portals.show(entries);
    this.colliders = [...this.staticColliders, ...this.portals.colliders];
    this.places = [
      ...this.city.places,
      ...this.camp.places,
      ...this.home.places,
      ...this.school.places,
      ...this.emotions.places,
      ...this.portals.places,
    ];
  }

  update(time: number, dt: number, focus: THREE.Vector3): void {
    this.water.update(time);
    this.city.update(time);
    this.camp.update(time);
    this.emotions.update(time);
    this.market.update(time, dt);
    this.portals.update(time);
    this.nature.update(dt);
    this.sky.follow(focus);
  }

  private addPath(scene: THREE.Scene): void {
    const stone = lowPoly(0xe3d5b0);
    const geometry = new THREE.CylinderGeometry(1.1, 1.2, 0.25, 7);
    const steps = Math.floor((PATH.fromZ - PATH.toZ) / 2.2);
    const mesh = new THREE.InstancedMesh(geometry, stone, steps);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < steps; i += 1) {
      const z = PATH.fromZ - i * 2.2;
      const x = Math.sin(i * 0.5) * 1.2;
      matrix.makeRotationY(i * 0.7).setPosition(x, this.shape.heightAt(x, z) + 0.05, z);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
