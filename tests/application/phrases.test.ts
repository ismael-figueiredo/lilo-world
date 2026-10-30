import { describe, expect, it } from 'vitest';
import { phrases } from '@application/phrases';

describe('phrases', () => {
  it('has a text for every id, fixed or filled in', () => {
    for (const [id, phrase] of Object.entries(phrases)) {
      const fill = phrase as string | ((...values: readonly unknown[]) => string);
      const text = typeof fill === 'string' ? fill : fill(1, 'Lilo');
      expect(text.trim(), id).not.toBe('');
      expect(text, id).not.toContain('undefined');
    }
  });

  it('counts stars in the right number', () => {
    expect(phrases.starsMissing(1, 'Casa')).toBe('Ganhe mais 1 estrela para abrir Casa.');
    expect(phrases.starsMissing(2, 'Casa')).toBe('Ganhe mais 2 estrelas para abrir Casa.');
  });

  it('adds what someone answers only when there is an answer', () => {
    expect(phrases.sentenceSaid('Eu quero pão', undefined)).toBe('Eu quero pão.');
    expect(phrases.sentenceSaid('Eu quero pão', 'Aqui está!')).toBe('Eu quero pão. Aqui está!');
    expect(phrases.missionDone(undefined)).toBe(phrases.completed);
    expect(phrases.missionDone('Obrigado!')).toBe(`Obrigado! ${phrases.completed}`);
  });
});
