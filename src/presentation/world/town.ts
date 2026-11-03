import * as THREE from 'three';
import type { Point } from '@domain/city/route';
import type { TrafficPhase } from '@domain/city/traffic-light';
import type { Random } from '@presentation/engine/math';
import { CITY, City, isInsideCity, PLAYGROUND, SOUTH_DISTRICT } from '@presentation/world/city';
import { isInsideAny, type Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import type { BakeryInterior } from '@presentation/world/bakery-interior';
import type { BeachPark } from '@presentation/world/beach-park';
import type { BusInterior } from '@presentation/world/bus-interior';
import type { FarmPark } from '@presentation/world/farm-park';
import type { MarketInterior } from '@presentation/world/market-interior';
import type { SchoolBuilding } from '@presentation/world/school-building';
import type { ZooPark } from '@presentation/world/zoo-park';
import { Nature } from '@presentation/world/nature';
import { lampGlass } from '@presentation/world/props';
import type { RoadSafety } from '@presentation/world/road-safety';
import { createTerrainMesh } from '@presentation/world/terrain-mesh';
import { defaultTerrainOptions, TerrainShape } from '@presentation/world/terrain-shape';
import { Water } from '@presentation/world/water';
import type { WorldAssets } from '@presentation/world/world-assets';
import { EMOTIONS_GARDEN } from '@presentation/world/zones/anchors';
import { zoneEntries, ZoneId } from '@presentation/world/zones/zone-entries';
import { ZoneManager } from '@presentation/world/zones/zone-manager';

/** Everything outside the child's house: island, sea, nature, city and zones. */
export class Town {
  readonly group = new THREE.Group();
  readonly shape: TerrainShape;
  colliders: readonly Collider[] = [];
  places: readonly Interactable[] = [];
  /** Who is out on the streets, besides the child. */
  people: readonly Point[] = [];
  /** Inside the market, far beyond the sea, once the child has been there. */
  market: MarketInterior | undefined;

  private readonly water = new Water();
  private readonly ground: THREE.Object3D;
  private readonly city: City;
  private readonly zones: ZoneManager;
  private readonly nature: Nature;
  private readonly staticColliders: Collider[];

  constructor(random: Random, assets: WorldAssets) {
    this.city = new City(assets);
    this.shape = new TerrainShape(random, {
      ...defaultTerrainOptions,
      flatAreas: [
        { x: CITY.x, z: CITY.z, radius: CITY.radius, height: CITY.height, blend: 14 },
        { ...SOUTH_DISTRICT, height: CITY.height, blend: 12 },
        { ...EMOTIONS_GARDEN, blend: 10 },
      ],
    });
    this.zones = new ZoneManager(
      zoneEntries,
      this.group,
      { assets, heightAt: (x, z) => this.shape.heightAt(x, z) },
      () => {
        this.collectZones();
      },
    );

    this.ground = createTerrainMesh(this.shape, random);
    this.group.add(this.ground, this.water.mesh, this.city.group);
    this.nature = new Nature(this.shape, random, assets, {
      keepClear: (x, z) =>
        isInsideCity(x, z, 3) ||
        Math.hypot(x - EMOTIONS_GARDEN.x, z - EMOTIONS_GARDEN.z) < EMOTIONS_GARDEN.radius + 2,
    });
    this.group.add(this.nature.group);
    this.staticColliders = [...this.city.colliders, ...this.nature.colliders];
    this.collectZones();
  }

  /** The zones of the island. */
  prepareIsland(): Promise<void> {
    return this.zones.prepareIsland();
  }

  /** Inside the bus and the school, far from the island, ready before they are needed. */
  prepareBus(): Promise<BusInterior> {
    return this.zones.prepare(ZoneId.bus) as Promise<BusInterior>;
  }

  prepareSchool(): Promise<SchoolBuilding> {
    return this.zones.prepare(ZoneId.schoolBuilding) as Promise<SchoolBuilding>;
  }

  prepareZoo(): Promise<ZooPark> {
    return this.zones.prepare(ZoneId.zoo) as Promise<ZooPark>;
  }

  prepareBeach(): Promise<BeachPark> {
    return this.zones.prepare(ZoneId.beach) as Promise<BeachPark>;
  }

  prepareBakery(): Promise<BakeryInterior> {
    return this.zones.prepare(ZoneId.bakery) as Promise<BakeryInterior>;
  }

  prepareFarm(): Promise<FarmPark> {
    return this.zones.prepare(ZoneId.farm) as Promise<FarmPark>;
  }

  get bus(): City {
    return this.city;
  }

  async prepareMarket(): Promise<MarketInterior> {
    const market = (await this.zones.prepare(ZoneId.market)) as MarketInterior;
    this.market = market;
    return market;
  }

  /** Draws every zone for a moment, for the picture of the map. */
  showAllZones(show: boolean): void {
    this.zones.showAll(show);
  }

  private collectZones(): void {
    this.colliders = [
      ...this.staticColliders,
      ...this.city.movingColliders,
      ...this.zones.colliders,
    ];
    this.places = [...this.city.places, ...this.zones.places];
  }

  get roadSafety(): RoadSafety {
    return this.city.roadSafety;
  }

  /** The traffic light cycle shared by the whole town. */
  get trafficPhase(): TrafficPhase {
    return this.city.phase;
  }

  /** Jumping belongs to play: on playgrounds, not on the way to places. */
  canJumpAt(x: number, z: number): boolean {
    return isInsideAny([PLAYGROUND], x, z);
  }

  /** Solid things that were added after the town was built. */
  addColliders(colliders: readonly Collider[]): void {
    this.staticColliders.push(...colliders);
    this.collectZones();
  }

  /** In a place far from here the island is not drawn: it costs and stands in the view. */
  setIslandVisible(visible: boolean): void {
    this.ground.visible = visible;
    this.water.mesh.visible = visible;
    this.city.group.visible = visible;
    this.nature.group.visible = visible;
  }

  /** The calm town: fewer cars and birds. */
  setCalm(calm: boolean): void {
    this.city.setCalm(calm);
  }

  mayCross(spot: Point): boolean {
    return this.city.mayCross(spot);
  }

  streetNoise(point: Point): number {
    return this.city.streetNoise(point);
  }

  setMotionScale(scale: number): void {
    this.water.motionScale = scale;
  }

  /** The time and the weather as the town shows them. */
  setSky(night: number, shade: number, wet: boolean): void {
    lampGlass().emissiveIntensity = night > 0.3 ? 2.4 : 0.6;
    this.city.setLightsOn(night > 0.3);
    this.city.setPuddles(wet);
    this.city.setNight(night > 0.3);
    this.nature.setClouds(shade);
  }

  setDetailed(detailed: boolean): void {
    this.nature.setDetailed(detailed);
  }

  setCloudsVisible(visible: boolean): void {
    this.nature.setCloudsVisible(visible);
  }

  update(time: number, dt: number, focus: THREE.Vector3): void {
    this.water.update(time);
    this.city.update(time, dt, [focus, ...this.people], focus);
    this.zones.update(time, dt, focus);
    this.nature.update(dt);
  }
}
