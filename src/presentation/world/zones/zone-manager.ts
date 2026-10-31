import type * as THREE from 'three';
import type { Area, Collider } from '@presentation/world/collision';
import type { Interactable } from '@presentation/world/interactable';
import type { Zone, ZoneContext, ZoneEntry } from '@presentation/world/zones/zone';

/** Meters beyond a zone's edge where it starts being drawn, and where it stops. */
const SHOW_MARGIN = 35;
const HIDE_MARGIN = 50;

interface Point {
  readonly x: number;
  readonly z: number;
}

/** A zone already drawn stays a little longer, so nothing flickers at the border. */
export function shouldShow(area: Area, point: Point, shown: boolean): boolean {
  const margin = shown ? HIDE_MARGIN : SHOW_MARGIN;
  return Math.hypot(point.x - area.x, point.z - area.z) <= area.radius + margin;
}

/** Frees what the graphics card holds. It comes back by itself when drawn again. */
function release(group: THREE.Group): void {
  group.traverse((child) => {
    const { geometry, material } = child as THREE.Mesh;
    (geometry as THREE.BufferGeometry | undefined)?.dispose();
    const materials = Array.isArray(material) ? material : [material];
    for (const item of materials)
      (item as { map?: THREE.Texture | null } | undefined)?.map?.dispose();
  });
}

/**
 * Downloads zones when asked and draws only the ones the child is near. A
 * prepared zone keeps its places and colliders, so the map and the missions
 * know it even while it is not being drawn.
 */
export class ZoneManager {
  private readonly requests = new Map<string, Promise<Zone>>();
  private readonly ready = new Map<string, Zone>();
  private readonly shown = new Set<string>();
  private showingAll = false;

  constructor(
    private readonly entries: readonly ZoneEntry[],
    private readonly scene: THREE.Object3D,
    private readonly context: ZoneContext,
    private readonly onChange: () => void,
  ) {}

  get colliders(): readonly Collider[] {
    return [...this.ready.values()].flatMap((zone) => zone.colliders);
  }

  get places(): readonly Interactable[] {
    return [...this.ready.values()].flatMap((zone) => zone.places);
  }

  /** Downloads and builds a zone, once. A failed download can be tried again. */
  prepare(id: string): Promise<Zone> {
    let request = this.requests.get(id);
    if (request === undefined) {
      request = this.build(id);
      request.catch(() => this.requests.delete(id));
      this.requests.set(id, request);
    }
    return request;
  }

  /** Everything on the island. A zone that failed is simply tried again later. */
  async prepareIsland(): Promise<void> {
    await Promise.allSettled(
      this.entries.filter((entry) => entry.onIsland).map((entry) => this.prepare(entry.id)),
    );
  }

  /** Draws everything for a moment, for the picture of the map. */
  showAll(show: boolean): void {
    this.showingAll = show;
    if (!show) return;
    for (const id of this.ready.keys()) this.show(id);
  }

  update(time: number, dt: number, position: Point): void {
    if (!this.showingAll) {
      for (const entry of this.entries) {
        if (!this.ready.has(entry.id)) continue;
        const wanted = shouldShow(entry.area, position, this.shown.has(entry.id));
        if (wanted) this.show(entry.id);
        else this.hide(entry.id);
      }
    }
    for (const id of this.shown) this.ready.get(id)?.update?.(time, dt);
  }

  private async build(id: string): Promise<Zone> {
    const entry = this.entries.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`Unknown zone: ${id}`);
    await this.context.assets.add(entry.models);
    const zone = await entry.build(this.context);
    this.ready.set(id, zone);
    this.onChange();
    return zone;
  }

  private show(id: string): void {
    const zone = this.ready.get(id);
    if (zone === undefined || this.shown.has(id)) return;
    this.shown.add(id);
    this.scene.add(zone.group);
  }

  private hide(id: string): void {
    const zone = this.ready.get(id);
    if (zone === undefined || !this.shown.delete(id)) return;
    this.scene.remove(zone.group);
    release(zone.group);
  }
}
