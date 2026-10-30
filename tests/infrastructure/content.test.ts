import { describe, expect, it } from 'vitest';
import { prepareMission } from '@domain/mission/prepare-mission';
import { DEFAULT_AVATAR_ID } from '@domain/profile/player-profile';
import { seededRandom } from '@domain/shared/random';
import { avatars, missions, wardrobeItems, worlds } from '@infrastructure/catalog/content';
import pictograms from '@infrastructure/catalog/pictograms.json';
import { withPictograms } from '@infrastructure/catalog/static-content-catalog';

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

  const everyVersion = missions.flatMap((mission) => [
    { mission, steps: mission.steps },
    ...(mission.variants ?? []).map((variant) => ({ mission, steps: variant.steps })),
  ]);

  it('asks only for choices that exist, in every variant', () => {
    for (const { mission, steps } of everyVersion) {
      const choiceIds = new Set(mission.choices.map((c) => c.id));
      for (const step of steps) {
        for (const id of [step.targetId, ...(step.accepts ?? [])]) {
          expect(choiceIds.has(id), id).toBe(true);
        }
      }
    }
  });

  it('accepts everything that fits and always leaves cards that clearly do not', () => {
    const quizzes = ['home-dressing', 'emotions-stories'];
    for (const mission of missions.filter((m) => quizzes.includes(m.id))) {
      const random = seededRandom(17);
      for (let play = 0; play < 60; play += 1) {
        const played = prepareMission(mission, random);
        const shelf = played.choices.map((c) => c.id);
        for (const step of played.steps) {
          const right = [step.targetId, ...(step.accepts ?? [])];
          const wrong = shelf.filter((id) => !right.includes(id));
          expect(wrong.length, step.prompt).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('takes any summer clothes when the sun is strong', () => {
    const dressing = missions.find((m) => m.id === 'home-dressing');
    const sunny = dressing?.variants
      ?.flatMap((v) => v.steps)
      .find((step) => step.prompt.includes('sol está forte'));
    expect([sunny?.targetId, ...(sunny?.accepts ?? [])].sort()).toEqual(
      ['cap', 'sandals', 'shorts', 'sunglasses'].sort(),
    );
  });

  it('keeps missions short (1 to 3 minutes), in every variant', () => {
    for (const { steps } of everyVersion) {
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.length).toBeLessThanOrEqual(5);
    }
  });

  it('never says the same sentence twice when a mission starts', () => {
    const versions = missions.flatMap((mission) => [mission, ...(mission.variants ?? [])]);
    for (const version of versions) {
      const first = version.steps[0]?.prompt ?? '';
      expect(version.introduction.endsWith(first), version.introduction).toBe(false);
    }
  });

  it('never praises twice at the end (the game adds the praise)', () => {
    const versions = missions.flatMap((mission) => [mission, ...(mission.variants ?? [])]);
    for (const version of versions) {
      expect(version.farewell ?? '', version.farewell).not.toMatch(/muito bem|você conseguiu/iu);
    }
  });

  it('never shows the answer card itself as the question', () => {
    for (const { mission, steps } of everyVersion) {
      for (const step of steps) {
        const answer = mission.choices.find((c) => c.id === step.targetId);
        if (step.show !== undefined) expect(step.show, step.prompt).not.toBe(answer?.pictogram);
      }
    }
  });

  it('never names the answer in a quiz question', () => {
    const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const stems = (text: string) =>
      plain(text)
        .split(/[^a-z]+/)
        .filter((word) => word.length > 3)
        .map((word) => word.slice(0, 5));
    for (const mission of missions.filter((m) => m.kind === 'quiz')) {
      const variants = [mission, ...(mission.variants ?? [])];
      for (const step of variants.flatMap((v) => v.steps)) {
        const asked = stems(step.prompt);
        for (const id of [step.targetId, ...(step.accepts ?? [])]) {
          const label = mission.choices.find((c) => c.id === id)?.label ?? '';
          expect(
            asked.filter((s) => stems(label).includes(s)),
            step.prompt,
          ).toEqual([]);
        }
      }
    }
  });

  it('charges one coin per thing bought at the market', () => {
    const market = missions.find((m) => m.id === 'city-market');
    expect(market?.variants?.length).toBeGreaterThanOrEqual(5);
    for (const variant of market?.variants ?? []) {
      const items = variant.steps.length - 1;
      expect(variant.steps.at(-1)?.targetId).toBe(`pay-${items}`);
    }
  });

  it('uses every shelf item in some recipe', () => {
    const market = missions.find((m) => m.id === 'city-market');
    const used = new Set(market?.variants?.flatMap((v) => v.steps.map((s) => s.targetId)));
    for (const choice of market?.choices ?? []) {
      if (choice.group === undefined) expect(used.has(choice.id), choice.id).toBe(true);
    }
  });

  it('lets every world be opened with the stars of the worlds before it', () => {
    // Worlds after one that has no missions yet are still being built.
    let stars = 0;
    for (const world of worlds) {
      expect(world.requiredStars, world.id).toBeLessThanOrEqual(stars);
      if (world.missionIds.length === 0) break;
      for (const id of world.missionIds) {
        stars += missions.find((m) => m.id === id)?.reward.stars ?? 0;
      }
    }
  });

  it('opens the first world from the start', () => {
    expect(worlds[0]?.requiredStars).toBe(0);
  });
});

describe('bundled avatars', () => {
  it('has unique ids, starting with the default avatar', () => {
    expect(new Set(avatars.map((a) => a.id)).size).toBe(avatars.length);
    expect(avatars[0]?.id).toBe(DEFAULT_AVATAR_ID);
  });
});

describe('pictograms', () => {
  it('names only labels that exist on some card', () => {
    const labels = new Set(missions.flatMap((m) => m.choices.map((c) => c.label)));
    const listed = Object.keys(pictograms).filter((key) => key !== '$comment');
    for (const label of listed) expect(labels.has(label), label).toBe(true);
  });

  it('puts the image on the card and keeps the emoji as fallback', () => {
    const market = missions.find((m) => m.id === 'city-market');
    if (market === undefined) throw new Error('Missing market');
    const apple = withPictograms(market).choices.find((c) => c.id === 'apple');
    expect(apple?.image).toBe('pictograms/2462.webp');
    expect(apple?.pictogram).toBe('🍎');
  });
});
