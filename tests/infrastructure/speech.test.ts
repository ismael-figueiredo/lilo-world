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
    expect(utterance).toMatchObject({ text: 'Olá', lang: 'pt-BR', rate: 0.92 });
  });

  it.each(['error', 'throw'] as const)('never fails when the browser %s', async (behavior) => {
    const speech = new WebSpeech(
      createSynth(behavior) as unknown as SpeechSynthesis,
      createUtterance,
    );
    await expect(speech.speak('Olá')).resolves.toBeUndefined();
  });

  it('uses the configured volume and speed, and stays quiet when the voice is off', async () => {
    const synth = createSynth('end');
    const speech = new WebSpeech(synth as unknown as SpeechSynthesis, createUtterance);
    speech.configure({ enabled: true, volume: 0.5, rate: 0.75 });
    await speech.speak('Oi');
    expect(synth.speak.mock.calls[0]?.[0]).toMatchObject({ volume: 0.5, rate: 0.75 });

    speech.configure({ enabled: false, volume: 1, rate: 1 });
    await speech.speak('Oi de novo');
    expect(synth.speak).toHaveBeenCalledTimes(1);
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
    speech.configure();
    await expect(speech.speak()).resolves.toBeUndefined();
    expect(() => {
      speech.stop();
    }).not.toThrow();
  });
});
