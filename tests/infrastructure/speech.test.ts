import { describe, expect, it, vi } from 'vitest';
import { SilentSpeech } from '@infrastructure/speech/silent-speech';
import { WebSpeech } from '@infrastructure/speech/web-speech';

type FakeUtterance = Partial<SpeechSynthesisUtterance> & { text: string };

const createSynth = (behavior: 'end' | 'error' | 'throw') => {
  const synth = {
    cancel: vi.fn(),
    speak: vi.fn((utterance: FakeUtterance) => {
      if (behavior === 'throw') throw new Error('not allowed');
      const handler = behavior === 'end' ? utterance.onend : utterance.onerror;
      (handler as (() => void) | null | undefined)?.();
    }),
  };
  return synth;
};

const createUtterance = (text: string) => ({ text }) as unknown as SpeechSynthesisUtterance;

describe('WebSpeech', () => {
  it('speaks in Brazilian Portuguese, calmly, interrupting the previous phrase', async () => {
    const synth = createSynth('end');
    await new WebSpeech(synth as unknown as SpeechSynthesis, createUtterance).speak('Olá');

    expect(synth.cancel).toHaveBeenCalled();
    const utterance = synth.speak.mock.calls[0]?.[0];
    expect(utterance).toMatchObject({ text: 'Olá', lang: 'pt-BR', rate: 0.9 });
  });

  it.each(['error', 'throw'] as const)('never fails when the browser %s', async (behavior) => {
    const speech = new WebSpeech(
      createSynth(behavior) as unknown as SpeechSynthesis,
      createUtterance,
    );
    await expect(speech.speak('Olá')).resolves.toBeUndefined();
  });

  it('stops speaking', () => {
    const synth = createSynth('end');
    new WebSpeech(synth as unknown as SpeechSynthesis, createUtterance).stop();
    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });
});

describe('SilentSpeech', () => {
  it('does nothing quietly', async () => {
    const speech = new SilentSpeech();
    await expect(speech.speak()).resolves.toBeUndefined();
    expect(() => {
      speech.stop();
    }).not.toThrow();
  });
});
