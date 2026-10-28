import { describe, expect, it } from 'vitest';
import { shelfOrder, spokenSentence } from '@presentation/ui/mission-panel';

describe('mission shelf order', () => {
  it('keeps the content order for lists and sentences', () => {
    expect(shelfOrder(['a', 'b', 'c', 'd'], 'pick-items')).toEqual(['a', 'b', 'c', 'd']);
    expect(shelfOrder(['a', 'b', 'c'], 'build-sentence')).toEqual(['a', 'b', 'c']);
  });

  it('never shows a sequence in the answer order, and always in the same order', () => {
    for (const steps of [
      ['a', 'b', 'c'],
      ['a', 'b', 'c', 'd'],
      ['a', 'b', 'c', 'd', 'e'],
    ]) {
      const shown = shelfOrder(steps, 'sequence');
      expect(shown).not.toEqual(steps);
      expect([...shown].sort()).toEqual(steps);
      expect(shelfOrder(steps, 'sequence')).toEqual(shown);
    }
  });
});

describe('AAC sentence', () => {
  it('reads the cards with commas where they are said', () => {
    expect(spokenSentence(['eu quero', 'pão', 'por favor'])).toBe('Eu quero pão, por favor');
    expect(spokenSentence(['bom dia', 'professora'])).toBe('Bom dia, professora');
    expect(spokenSentence(['posso', 'ir ao banheiro'])).toBe('Posso ir ao banheiro');
  });
});
