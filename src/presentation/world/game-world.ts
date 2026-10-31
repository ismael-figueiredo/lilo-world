import type * as THREE from 'three';
import type { Random } from '@presentation/engine/math';
import type { Quality } from '@presentation/engine/quality';
import { CityPlace } from '@presentation/world/city';
import type { Collider } from '@presentation/world/collision';
import { House } from '@presentation/world/house';
import type { Interactable } from '@presentation/world/interactable';
import { Sky } from '@presentation/world/sky';
import { Town } from '@presentation/world/town';
import type { WorldAssets } from '@presentation/world/world-assets';

const shadowSizes: Readonly<Record<Quality, number>> = { high: 2048, medium: 1536, low: 1024 };

/**
 * The child's house, ready at once, and the town outside: its models start
 * downloading in the background and it is built when the child opens the door.
 */
export class GameWorld {
  readonly sky: Sky;
  readonly house = new House();
  /** Where the child stands: only what is around them is drawn. */
  indoors = true;
  private town: Town | undefined;
  private assets: Promise<WorldAssets> | undefined;
  private building: Promise<Town> | undefined;
  private motion = 1;
  private quality: Quality = 'high';

  constructor(
    private readonly scene: THREE.Scene,
    private readonly random: Random,
    private readonly loadAssets: () => Promise<WorldAssets>,
  ) {
    this.sky = new Sky(scene);
    scene.add(this.house.group);
  }

  /** Starts the download without building anything: nobody waits for it. */
  downloadTown(): void {
    void this.townAssets().catch(() => undefined);
  }

  /** Downloads and builds the town, once. A failed download can be tried again. */
  openTown(): Promise<Town> {
    this.building ??= this.build();
    this.building.catch(() => {
      this.building = undefined;
    });
    return this.building;
  }

  private townAssets(): Promise<WorldAssets> {
    this.assets ??= this.loadAssets();
    this.assets.catch(() => {
      this.assets = undefined;
    });
    return this.assets;
  }

  private async build(): Promise<Town> {
    const assets = await this.townAssets();
    const town = new Town(this.random, assets);
    town.group.visible = !this.indoors;
    this.scene.add(town.group);
    town.setMotionScale(this.motion);
    town.setDetailed(this.quality !== 'low');
    await town.prepareIsland();
    this.town = town;
    return town;
  }

  /** The town, once the child has opened the door. */
  get outside(): Town | undefined {
    return this.town;
  }

  get colliders(): readonly Collider[] {
    return this.indoors ? this.house.colliders : (this.town?.colliders ?? []);
  }

  get places(): readonly Interactable[] {
    return this.indoors ? this.house.places : (this.town?.places ?? []);
  }

  /** Places of the town, known by the map. */
  get townPlaces(): readonly Interactable[] {
    return this.town?.places ?? [];
  }

  /** The front door of the house, seen from the street. */
  get street(): Interactable | undefined {
    return this.townPlaces.find((place) => place.id === CityPlace.home);
  }

  heightAt(x: number, z: number): number {
    if (this.house.contains(x, z)) return this.house.floor;
    return this.town?.shape.heightAt(x, z) ?? this.house.floor;
  }

  isWalkable(x: number, z: number): boolean {
    if (this.indoors) return this.house.contains(x, z);
    return this.town?.shape.isWalkable(x, z) ?? false;
  }

  canJumpAt(x: number, z: number): boolean {
    return !this.indoors && this.town?.canJumpAt(x, z) === true;
  }

  /** Crossing the door: drawing the other side only. */
  setIndoors(indoors: boolean): void {
    this.indoors = indoors;
    this.house.group.visible = indoors;
    if (this.town !== undefined) this.town.group.visible = !indoors;
  }

  setMotionScale(scale: number): void {
    this.motion = scale;
    this.town?.setMotionScale(scale);
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    this.town?.setDetailed(quality !== 'low');
    this.sky.setShadowSize(shadowSizes[quality]);
  }

  update(time: number, dt: number, focus: THREE.Vector3): void {
    if (this.indoors) this.house.update(time);
    else this.town?.update(time, dt, focus);
    this.sky.follow(focus);
  }
}
