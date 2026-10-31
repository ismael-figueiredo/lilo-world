import { describe, expect, it, vi, beforeAll } from 'vitest';
import {
  BEACH_WALLET,
  isBeachDay,
  isPacked,
  KIOSK_PRICE,
  mayEnterWater,
  packList,
  seaFlag,
  shellRound,
} from '@domain/beach/beach';
import { KeepBeachMemory } from '@application/use-cases/keep-beach-memory';
import { total } from '@domain/money/money';
import { seededRandom } from '@domain/shared/random';
import { allStickers, beachStickerId } from '@domain/stickers/sticker';
import { InMemoryProgressRepository } from '@infrastructure/persistence/in-memory-progress-repository';
import type { BeachPark } from '@presentation/world/beach-park';

describe('a day at the beach', () => {
  it('only happens with good weather', () => {
    expect(isBeachDay('sunny')).toBe(true);
    expect(isBeachDay('rain')).toBe(false);
    expect(isBeachDay('cold')).toBe(false);
  });

  it('needs the whole bag', () => {
    expect(isPacked(packList)).toBe(true);
    expect(isPacked(packList.slice(1))).toBe(false);
  });

  it('only lets the child in the water under the green flag', () => {
    expect(mayEnterWater(seaFlag('sunny'))).toBe(true);
    expect(mayEnterWater(seaFlag('cloudy'))).toBe(false);
  });

  it('counts shells that are really on the sand', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const round = shellRound(seededRandom(seed));
      expect(round.shells.filter((color) => color === round.asked)).toHaveLength(round.answer);
      expect(new Set(round.options).size).toBe(3);
      expect(round.options).toContain(round.answer);
    }
  });

  it('always has enough money at the kiosk', () => {
    expect(total(BEACH_WALLET)).toBeGreaterThanOrEqual(KIOSK_PRICE);
  });

  it('keeps the castle in the album', async () => {
    const progress = new InMemoryProgressRepository();
    await new KeepBeachMemory(progress).execute('castle');
    expect((await progress.load()).hasSticker(beachStickerId('castle'))).toBe(true);
    expect(allStickers.some((sticker) => sticker.id === beachStickerId('castle'))).toBe(true);
  });
});

describe('the sea', () => {
  let beach: BeachPark;
  let limit: number;

  function fakeCanvas(): unknown {
    const context: object = new Proxy(
      {},
      {
        get: (_, key) => (key === 'measureText' ? () => ({ width: 10 }) : () => context),
        set: () => true,
      },
    );
    return { width: 0, height: 0, getContext: () => context, style: {} };
  }

  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: fakeCanvas });
    const { BeachPark, SHALLOW_LIMIT } = await import('@presentation/world/beach-park');
    beach = new BeachPark();
    limit = SHALLOW_LIMIT;
  });

  it('can never be walked past the buoys', () => {
    const origin = beach.entrance;
    for (let x = -40; x <= 40; x += 2) {
      for (let z = limit - 30; z <= limit; z += 0.5) {
        expect(beach.contains(origin.x + x, origin.z - 12 + z)).toBe(false);
      }
    }
    expect(beach.contains(origin.x, origin.z)).toBe(true);
  });

  it('has the shallow spot inside the buoys', () => {
    expect(beach.contains(beach.shallow.x, beach.shallow.z)).toBe(true);
  });
});
