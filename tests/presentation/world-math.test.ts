import { describe, expect, it } from 'vitest';
import { clamp, dampAngle, seededRandom, smoothstep } from '@presentation/engine/math';
import { cameraRelative, joystickInput, keyboardInput } from '@presentation/engine/movement';
import { box, circle, firstObstruction, resolveCollisions } from '@presentation/world/collision';
import {
  defaultTerrainOptions,
  TerrainShape,
  WATER_LEVEL,
} from '@presentation/world/terrain-shape';

describe('math helpers', () => {
  it('repeats the same random sequence for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const values = Array.from({ length: 5 }, () => a());
    expect(values).toEqual(Array.from({ length: 5 }, () => b()));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('clamps and smooths', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it('turns through the shortest way around', () => {
    const next = dampAngle(Math.PI - 0.1, -Math.PI + 0.1, 1000, 1);
    expect(next).toBeCloseTo(Math.PI + 0.1);
    expect(next).toBeGreaterThan(Math.PI - 0.1);
  });
});

describe('TerrainShape', () => {
  const shape = new TerrainShape(seededRandom(7), {
    ...defaultTerrainOptions,
    flatAreas: [{ x: 0, z: 0, radius: 20, height: 1.5, blend: 10 }],
  });

  it('is exactly flat inside a flat area', () => {
    expect(shape.heightAt(0, 0)).toBeCloseTo(1.5);
    expect(shape.heightAt(10, -10)).toBeCloseTo(1.5);
  });

  it('sinks under water far from the island', () => {
    expect(shape.heightAt(400, 0)).toBeLessThan(WATER_LEVEL);
    expect(shape.isWalkable(400, 0)).toBe(false);
    expect(shape.isWalkable(0, 0)).toBe(true);
  });
});

describe('collision', () => {
  it('pushes out of a circle', () => {
    const result = resolveCollisions({ x: 0.5, z: 0 }, 0.5, [circle(0, 0, 1)]);
    expect(result.x).toBeCloseTo(1.5);
    expect(result.z).toBeCloseTo(0);
  });

  it('pushes out of a box edge and through the nearest side when inside', () => {
    const wall = box(0, 0, 4, 4);
    expect(resolveCollisions({ x: 2.2, z: 0 }, 0.5, [wall]).x).toBeCloseTo(2.5);
    expect(resolveCollisions({ x: 1.8, z: 0.2 }, 0.5, [wall]).x).toBeCloseTo(2.5);
  });

  it('leaves free positions alone', () => {
    expect(resolveCollisions({ x: 10, z: 10 }, 0.5, [circle(0, 0, 1), box(0, 0, 2, 2)])).toEqual({
      x: 10,
      z: 10,
    });
  });
});

describe('movement', () => {
  it('ignores tiny joystick movements and runs at the edge', () => {
    expect(joystickInput(2, 0, 60)).toEqual({ x: 0, y: 0, running: false });
    const full = joystickInput(0, -60, 60);
    expect(full.y).toBeCloseTo(1);
    expect(full.running).toBe(true);
  });

  it('normalizes diagonal keyboard movement', () => {
    const input = keyboardInput(new Set(['KeyW', 'KeyD']));
    expect(Math.hypot(input.x, input.y)).toBeCloseTo(1);
    expect(keyboardInput(new Set(['ShiftLeft'])).running).toBe(true);
  });

  it('moves away from the camera when pushing forward', () => {
    // Camera at yaw 0 sits on +z looking towards -z.
    const forward = cameraRelative({ x: 0, y: 1, running: false }, 0);
    expect(forward.x).toBeCloseTo(0);
    expect(forward.z).toBeCloseTo(-1);
    const right = cameraRelative({ x: 1, y: 0, running: false }, 0);
    expect(right.x).toBeCloseTo(1);
  });
});

describe('firstObstruction', () => {
  const wall = box(0, 0, 4, 4, 5);

  it('finds where a tall wall cuts the view', () => {
    const t = firstObstruction({ x: -6, y: 2, z: 0 }, { x: 6, y: 2, z: 0 }, [wall]);
    expect(t).toBeCloseTo(4 / 12);
  });

  it('ignores walls the line passes over, and low boxes', () => {
    expect(firstObstruction({ x: -6, y: 8, z: 0 }, { x: 6, y: 8, z: 0 }, [wall])).toBe(1);
    expect(firstObstruction({ x: -6, y: 2, z: 0 }, { x: 6, y: 2, z: 0 }, [box(0, 0, 4, 4)])).toBe(
      1,
    );
  });
});
