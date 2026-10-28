import { describe, expect, it } from 'vitest';
import { missions, wardrobeItems, worlds } from '@infrastructure/catalog/content';

/** Guards the bundled content against typos that would break a mission. */
describe('bundled content', () => {
  it('has unique ids', () => {
    const unique = (ids: string[]) => new Set(ids).size === ids.length;
    expect(unique(worlds.map((w) => w.id))).toBe(true);
    expect(unique(missions.map((m) => m.id))).toBe(true);
    expect(unique(wardrobeItems.map((i) => i.id))).toBe(true);
  });

  it('points every world to existing missions', () => {
    const missionIds = new Set(missions.map((m) => m.id));
    for (const world of worlds) {
      for (const id of world.missionIds) expect(missionIds.has(id)).toBe(true);
    }
  });

  it('asks only for choices that are on screen', () => {
    for (const mission of missions) {
      const choiceIds = new Set(mission.choices.map((c) => c.id));
      for (const step of mission.steps) expect(choiceIds.has(step.targetId)).toBe(true);
    }
  });

  it('keeps missions short (1 to 3 minutes)', () => {
    for (const mission of missions) {
      expect(mission.steps.length).toBeGreaterThan(0);
      expect(mission.steps.length).toBeLessThanOrEqual(5);
    }
  });

  it('opens the first world from the start', () => {
    expect(worlds[0]?.requiredStars).toBe(0);
  });
});
