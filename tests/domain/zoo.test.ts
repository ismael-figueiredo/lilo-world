import { describe, expect, it } from 'vitest';
import { MeetAnimal } from '@application/use-cases/meet-animal';
import { seededRandom } from '@domain/shared/random';
import { allStickers, animalStickerId } from '@domain/stickers/sticker';
import {
  animalOf,
  animals,
  foodOptions,
  isAnimal,
  OUTING_WALLET,
  TICKET_PRICE,
  zooChallenge,
} from '@domain/zoo/animals';
import { total } from '@domain/money/money';
import { InMemoryProgressRepository } from '@infrastructure/persistence/in-memory-progress-repository';

describe('the animals', () => {
  it('are ten, each with what the visit needs', () => {
    expect(animals).toHaveLength(10);
    expect(new Set(animals.map((a) => a.id)).size).toBe(10);
    expect(isAnimal('lion')).toBe(true);
    expect(isAnimal('dragon')).toBe(false);
    expect(animalOf('giraffe').name).toBe('Girafa');
  });

  it('always have one right answer among different options', () => {
    for (const animal of animals) {
      for (let seed = 0; seed < 40; seed += 1) {
        const challenge = zooChallenge(animal, seededRandom(seed));
        const ids = challenge.options.map((option) => option.id);
        expect(new Set(ids).size, animal.id).toBe(ids.length);
        expect(ids.length, animal.id).toBeGreaterThanOrEqual(2);
        expect(ids, animal.id).toContain(challenge.answerId);
        expect(challenge.question, animal.id).not.toContain(challenge.answerId);
      }
    }
  });

  it('are offered their food among others', () => {
    for (const animal of animals) {
      const ids = foodOptions(animal, seededRandom(3)).map((option) => option.id);
      expect(ids).toContain(animal.food);
      expect(ids.length).toBe(3);
    }
  });

  it('are in the album, and meeting one counts once', async () => {
    expect(allStickers.some((sticker) => sticker.id === animalStickerId('lion'))).toBe(true);
    const progress = new InMemoryProgressRepository();
    const meet = new MeetAnimal(progress);
    await expect(meet.execute('lion')).resolves.toBe(animalStickerId('lion'));
    await expect(meet.execute('lion')).resolves.toBeUndefined();
    expect((await progress.load()).hasSticker(animalStickerId('lion'))).toBe(true);
  });
});

describe('the ticket', () => {
  it('can always be paid with what the adult gives', () => {
    expect(total(OUTING_WALLET)).toBeGreaterThanOrEqual(TICKET_PRICE);
  });
});
