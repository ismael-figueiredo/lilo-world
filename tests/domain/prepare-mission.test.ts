import { describe, expect, it } from 'vitest';
import type { Mission } from '@domain/mission/mission';
import { prepareMission } from '@domain/mission/prepare-mission';
import { seededRandom } from '@domain/shared/random';
import { missions } from '@infrastructure/catalog/content';
import { mission as plain } from '../support/fixtures';

const missionById = (id: string): Mission => {
  const found = missions.find((m) => m.id === id);
  if (found === undefined) throw new Error(`Missing mission ${id}`);
  return found;
};
const market = missionById('city-market');
const bakery = missionById('city-bakery');

describe('prepareMission', () => {
  it('leaves a mission without variants or distractors as it is (shelf order aside)', () => {
    const played = prepareMission(plain, seededRandom(1));
    expect(played.steps).toEqual(plain.steps);
    expect([...played.choices].map((c) => c.id).sort()).toEqual(
      plain.choices.map((c) => c.id).sort(),
    );
  });

  it('picks different recipes over many plays, so every item gets its turn', () => {
    const random = seededRandom(7);
    const recipes = new Set<string>();
    const targets = new Set<string>();
    for (let i = 0; i < 80; i += 1) {
      const played = prepareMission(market, random);
      recipes.add(played.title);
      for (const step of played.steps) targets.add(step.targetId);
    }
    expect(recipes.size).toBe(market.variants?.length);
    expect(targets.has('carrot')).toBe(true);
  });

  it('shows every item asked for, a few others, and coins around the price', () => {
    const random = seededRandom(3);
    for (let i = 0; i < 40; i += 1) {
      const played = prepareMission(market, random);
      const ids = played.choices.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const step of played.steps) expect(ids).toContain(step.targetId);

      const items = played.steps.length - 1;
      const shelf = played.choices.filter((c) => c.group === undefined);
      expect(shelf).toHaveLength(items + 3);
      const coins = played.choices.filter((c) => c.group === 'cashier').map((c) => c.id);
      expect(coins).toHaveLength(3);
      expect(coins).toContain(`pay-${items}`);
      for (const id of coins) expect(Math.abs(Number(id.slice(4)) - items)).toBeLessThanOrEqual(2);
      // The cashier's coins come after the shelf, so the shelf shows first.
      expect(played.choices.at(-1)?.group).toBe('cashier');
    }
  });

  it('keeps AAC cards in their usual order', () => {
    const played = prepareMission(bakery, seededRandom(5));
    const order = bakery.choices.map((c) => c.id);
    const shown = played.choices.map((c) => order.indexOf(c.id));
    expect(shown).toEqual([...shown].sort((a, b) => a - b));
    expect(played.steps.map((s) => s.targetId)).toContain('please');
  });

  it('asks quiz questions whose answers are always on the shelf', () => {
    const animals = missionById('nature-animals');
    const random = seededRandom(13);
    for (let i = 0; i < 30; i += 1) {
      const played = prepareMission(animals, random);
      const ids = played.choices.map((c) => c.id);
      for (const step of played.steps) {
        expect(ids).toContain(step.targetId);
        expect(step.show).toBeDefined();
      }
      expect(ids).toHaveLength(played.steps.length + 2);
    }
  });

  it('is the same for the same seed', () => {
    expect(prepareMission(market, seededRandom(9))).toEqual(
      prepareMission(market, seededRandom(9)),
    );
  });
});
