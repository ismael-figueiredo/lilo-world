import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { smoothstep, type Random } from '@presentation/engine/math';

export const WATER_LEVEL = 0;

/** An area flattened for building (the city, a plaza, the portal hill). */
export interface FlatArea {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly height: number;
  /** Width of the smooth transition back to natural terrain. */
  readonly blend: number;
}

export interface TerrainOptions {
  readonly islandRadius: number;
  readonly shoreWidth: number;
  readonly hillHeight: number;
  readonly baseHeight: number;
  readonly seaFloor: number;
  readonly flatAreas: readonly FlatArea[];
}

export const defaultTerrainOptions: TerrainOptions = {
  islandRadius: 100,
  shoreWidth: 26,
  hillHeight: 9,
  baseHeight: 1.2,
  seaFloor: -5,
  flatAreas: [],
};

/** Height of the island at any point. Pure: no Three.js, so it is cheap and testable. */
export class TerrainShape {
  private readonly noise: NoiseFunction2D;

  constructor(
    random: Random,
    readonly options: TerrainOptions = defaultTerrainOptions,
  ) {
    this.noise = createNoise2D(random);
  }

  heightAt(x: number, z: number): number {
    const { islandRadius, shoreWidth, hillHeight, baseHeight, seaFloor, flatAreas } = this.options;

    let hills = 0;
    let frequency = 0.011;
    let amplitude = 1;
    for (let octave = 0; octave < 4; octave += 1) {
      hills += this.noise(x * frequency, z * frequency) * amplitude;
      frequency *= 2.1;
      amplitude *= 0.45;
    }
    const land = baseHeight + Math.max(0, hills * 0.5 + 0.35) * hillHeight;

    // An irregular coastline instead of a perfect circle.
    const coastNoise = this.noise(x * 0.018 + 40, z * 0.018 - 40) * 12;
    const distance = Math.hypot(x, z) + coastNoise;
    const landMask = 1 - smoothstep(islandRadius, islandRadius + shoreWidth, distance);
    let height = seaFloor + (land - seaFloor) * landMask;

    for (const area of flatAreas) {
      const weight =
        1 - smoothstep(area.radius, area.radius + area.blend, Math.hypot(x - area.x, z - area.z));
      height += (area.height - height) * weight;
    }
    return height;
  }

  /** The child can walk anywhere on land, but never into deep water. */
  isWalkable(x: number, z: number): boolean {
    return this.heightAt(x, z) > WATER_LEVEL + 0.15;
  }
}
