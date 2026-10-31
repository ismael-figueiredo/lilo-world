import { describe, expect, it } from 'vitest';
import {
  advance,
  allPicked,
  billOf,
  emptyErrand,
  isBakeryRun,
  nextToPick,
  pay,
  pick,
  planErrand,
  sanitizeErrand,
  type MoneyLevel,
} from '@domain/errand/errand';
import { completeStep, firstDay, sanitizeDay, skipBlock } from '@domain/day/day-plan';
import {
  changeFor,
  fewestPieces,
  noteFor,
  spoken,
  total,
  withoutPieces,
  written,
} from '@domain/money/money';

describe('money', () => {
  it('is written and said as people do', () => {
    expect(written(700)).toBe('R$ 7');
    expect(written(750)).toBe('R$ 7,50');
    expect(spoken(100)).toBe('1 real');
    expect(spoken(750)).toBe('7 reais e 50 centavos');
    expect(spoken(50)).toBe('50 centavos');
  });

  it('gives any amount in the fewest pieces', () => {
    expect(fewestPieces(800)).toEqual([500, 200, 100]);
    expect(total(fewestPieces(1750))).toBe(1750);
  });

  it('finds the change, and none while it is not enough', () => {
    expect(changeFor(1000, 700)).toBe(300);
    expect(changeFor(500, 700)).toBeUndefined();
    expect(noteFor(700)).toBe(1000);
    expect(withoutPieces([500, 200, 100], [200])).toEqual([500, 100]);
  });
});

describe('the lunch task', () => {
  const levels: readonly MoneyLevel[] = ['exact', 'change', 'cents'];

  it('is different from one day to the next, and the same on the same day', () => {
    expect(planErrand(1, 'exact').recipe).not.toBe(planErrand(2, 'exact').recipe);
    expect(planErrand(3, 'change')).toEqual(planErrand(3, 'change'));
  });

  it('always gives enough money, on every day and level', () => {
    for (let day = 1; day < 40; day += 1) {
      for (const level of levels) {
        const errand = planErrand(day, level);
        expect(errand.list.length).toBeGreaterThan(0);
        expect(total(errand.wallet)).toBeGreaterThanOrEqual(billOf(errand));
      }
    }
  });

  it('asks for the exact amount first, and for change later', () => {
    const exact = planErrand(1, 'exact');
    expect(exact.wallet.length).toBeGreaterThan(1);
    const change = planErrand(1, 'change');
    expect(change.wallet).toHaveLength(1);
    expect(total(change.wallet)).toBeGreaterThan(billOf(change));
    expect(billOf(planErrand(1, 'cents')) % 100).toBe(0);
    const single = { ...planErrand(1, 'cents'), list: planErrand(1, 'cents').list.slice(0, 1) };
    expect(billOf(single) % 100).toBe(50);
  });

  it('goes to the bakery on the sandwich day', () => {
    const bakery = Array.from({ length: 5 }, (_, i) => planErrand(i + 1, 'exact')).filter(
      isBakeryRun,
    );
    expect(bakery).toHaveLength(1);
    expect(bakery[0]?.list).toEqual(['bread']);
  });

  it('runs from the list to the change, saved at each stage', () => {
    let errand = advance(planErrand(1, 'change'));
    expect(errand.stage).toBe('shop');
    expect(allPicked(errand)).toBe(false);
    for (const id of errand.list) errand = pick(errand, id);
    expect(nextToPick(errand)).toBeUndefined();
    const note = errand.wallet;
    const bill = billOf(errand);
    const paid = pay(errand, note);
    expect(paid.stage).toBe('bring');
    expect(paid.change).toBe(total(note) - bill);
    expect(total(paid.wallet)).toBe(paid.change);
    expect(advance(paid).stage).toBe('cook');
  });

  it('ignores what is not on the list, and money that is not enough', () => {
    const errand = advance(planErrand(1, 'exact'));
    expect(pick(errand, 'milk')).toBe(errand);
    expect(pay(errand, [])).toBe(errand);
  });

  it('survives a save, and a broken one only starts over', () => {
    const errand = advance(planErrand(2, 'change'));
    expect(sanitizeErrand(JSON.parse(JSON.stringify(errand)))).toEqual(errand);
    expect(sanitizeErrand({ stage: 'shop', recipe: 'cake', level: 'exact' })).toBeUndefined();
    expect(sanitizeErrand('nope')).toBeUndefined();
    expect(
      sanitizeErrand({ ...emptyErrand('soup'), list: ['carrot', 'stone'], wallet: [500, 3] }),
    ).toMatchObject({ list: ['carrot'], wallet: [500] });
  });

  it('lives in the day: saved with it and gone with a new day', () => {
    const errand = planErrand(1, 'exact');
    const day = { ...firstDay, errand };
    expect(sanitizeDay(JSON.parse(JSON.stringify(day))).errand).toEqual(errand);
    expect(skipBlock(day).errand).toBeUndefined();
    const lastNight = {
      number: 1,
      done: ['wake', 'eat', 'teeth', 'dress', 'backpack', 'lunch', 'study', 'outside'],
    };
    const night = { ...lastNight, done: [...lastNight.done, 'shower', 'pajamas'], errand };
    expect(completeStep(night as never, 'sleep').day.errand).toBeUndefined();
  });
});
