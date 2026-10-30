import type * as THREE from 'three';
import type { Area, Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import type { WorldAssets, WorldModelId } from '@presentation/world/world-assets';

/** A part of the world that is downloaded, drawn and let go on its own. */
export interface Zone {
  readonly group: THREE.Group;
  readonly colliders: readonly Collider[];
  readonly places: readonly Interactable[];
  update?(time: number, dt: number): void;
}

export interface ZoneContext {
  readonly assets: WorldAssets;
  readonly heightAt: (x: number, z: number) => number;
}

/** What is known about a zone before it is downloaded. */
export interface ZoneEntry {
  readonly id: string;
  /** Close to this area the zone is drawn. */
  readonly area: Area;
  /** Models only this zone uses, downloaded with it. */
  readonly models: readonly WorldModelId[];
  /** Far away zones (the inside of the market) are prepared when the child goes there. */
  readonly onIsland: boolean;
  readonly build: (context: ZoneContext) => Promise<Zone>;
}
