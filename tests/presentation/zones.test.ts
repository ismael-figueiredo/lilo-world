import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { circle } from '@presentation/world/collision';
import type { WorldAssets } from '@presentation/world/world-assets';
import type { Zone, ZoneContext, ZoneEntry } from '@presentation/world/zones/zone';
import { shouldShow, ZoneManager } from '@presentation/world/zones/zone-manager';

const area = { x: 100, z: 0, radius: 10 };

const zone = (): Zone => {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  return { group, colliders: [circle(100, 0, 1)], places: [] };
};

const entry = (id: string, onIsland = true, built = zone()): ZoneEntry => ({
  id,
  area,
  models: [],
  onIsland,
  build: () => Promise.resolve(built),
});

const setup = (entries: readonly ZoneEntry[]) => {
  const scene = new THREE.Group();
  const add = vi.fn(() => Promise.resolve());
  const context: ZoneContext = { assets: { add } as unknown as WorldAssets, heightAt: () => 0 };
  const onChange = vi.fn();
  return { scene, add, onChange, zones: new ZoneManager(entries, scene, context, onChange) };
};

const near = { x: 100, z: 5 };
const far = { x: 0, z: 0 };

describe('zones', () => {
  it('draws a zone only near it, and keeps it a little longer at the border', () => {
    expect(shouldShow(area, { x: 60, z: 0 }, false)).toBe(true);
    expect(shouldShow(area, { x: 50, z: 0 }, false)).toBe(false);
    expect(shouldShow(area, { x: 50, z: 0 }, true)).toBe(true);
    expect(shouldShow(area, { x: 30, z: 0 }, true)).toBe(false);
  });

  it('builds a zone once, even when asked twice', async () => {
    const built = entry('a');
    const build = vi.spyOn(built, 'build');
    const { zones, onChange } = setup([built]);
    await Promise.all([zones.prepare('a'), zones.prepare('a')]);
    expect(build).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('prepares the island, but not the zones far from it', async () => {
    const { zones } = setup([entry('a'), entry('market', false)]);
    await zones.prepareIsland();
    expect(zones.colliders).toHaveLength(1);
  });

  it('keeps colliders while a prepared zone is not drawn', async () => {
    const { zones, scene } = setup([entry('a')]);
    await zones.prepare('a');
    zones.update(0, 0, far);
    expect(scene.children).toHaveLength(0);
    expect(zones.colliders).toHaveLength(1);
  });

  it('frees the graphics memory when the child leaves, and draws it again on return', async () => {
    const built = zone();
    const { zones, scene } = setup([entry('a', true, built)]);
    await zones.prepare('a');
    const mesh = built.group.children[0] as THREE.Mesh;
    const dispose = vi.fn();
    mesh.geometry.addEventListener('dispose', dispose);

    zones.update(0, 0, near);
    expect(scene.children).toEqual([built.group]);
    zones.update(0, 0, far);
    expect(scene.children).toEqual([]);
    expect(dispose).toHaveBeenCalledTimes(1);
    zones.update(0, 0, near);
    expect(scene.children).toEqual([built.group]);
  });

  it('updates only what is drawn', async () => {
    const built = { ...zone(), update: vi.fn() };
    const { zones } = setup([entry('a', true, built)]);
    await zones.prepare('a');
    zones.update(1, 0.1, far);
    expect(built.update).not.toHaveBeenCalled();
    zones.update(2, 0.1, near);
    expect(built.update).toHaveBeenCalledWith(2, 0.1);
  });

  it('downloads the models a zone needs before building it', async () => {
    const { zones, add } = setup([{ ...entry('a'), models: ['cow'] }]);
    await zones.prepare('a');
    expect(add).toHaveBeenCalledWith(['cow']);
  });

  it('draws everything for the picture of the map, then goes back to normal', async () => {
    const { zones, scene } = setup([entry('a')]);
    await zones.prepare('a');
    zones.showAll(true);
    zones.update(0, 0, far);
    expect(scene.children).toHaveLength(1);
    zones.showAll(false);
    zones.update(0, 0, far);
    expect(scene.children).toHaveLength(0);
  });

  it('can try a failed download again', async () => {
    const build = vi
      .fn<() => Promise<Zone>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(zone());
    const { zones } = setup([{ ...entry('a'), build }]);
    await expect(zones.prepare('a')).rejects.toThrow('offline');
    await expect(zones.prepare('a')).resolves.toBeDefined();
  });

  it('refuses a zone that does not exist', async () => {
    const { zones } = setup([]);
    await expect(zones.prepare('nowhere')).rejects.toThrow('nowhere');
  });
});
