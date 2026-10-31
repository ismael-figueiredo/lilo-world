import { describe, expect, it } from 'vitest';
import { RecordedSpeech, type VoiceClip } from '@infrastructure/speech/recorded-speech';
import { FakeSpeech } from '../support/fixtures';

const clip = (result: 'ends' | 'fails'): VoiceClip & { played: boolean } => {
  const fake: VoiceClip & { played: boolean } = {
    volume: 1,
    played: false,
    onended: null,
    onerror: null,
    pause: () => undefined,
    play() {
      fake.played = true;
      if (result === 'fails') return Promise.reject(new Error('no file'));
      queueMicrotask(() => {
        (fake.onended as unknown as () => void)();
      });
      return Promise.resolve();
    },
  };
  return fake;
};

describe('recorded voice', () => {
  it('plays the recording of a phrase that has one', async () => {
    const fallback = new FakeSpeech();
    const played = clip('ends');
    const speech = new RecordedSpeech(
      fallback,
      () => Promise.resolve({ Oi: 'oi.mp3' }),
      () => played,
    );
    await speech.speak('Oi');
    expect(played.played).toBe(true);
    expect(fallback.spoken).toEqual([]);
  });

  it('uses the synthetic voice for what is not recorded yet', async () => {
    const fallback = new FakeSpeech();
    const speech = new RecordedSpeech(
      fallback,
      () => Promise.resolve({}),
      () => clip('ends'),
    );
    await speech.speak('Tchau');
    expect(fallback.spoken).toEqual(['Tchau']);
  });

  it('never leaves the child without the sentence when a file fails', async () => {
    const fallback = new FakeSpeech();
    const speech = new RecordedSpeech(
      fallback,
      () => Promise.resolve({ Oi: 'oi.mp3' }),
      () => clip('fails'),
    );
    await speech.speak('Oi');
    expect(fallback.spoken).toEqual(['Oi']);
  });

  it('stays silent when the voice is off', async () => {
    const fallback = new FakeSpeech();
    const speech = new RecordedSpeech(
      fallback,
      () => Promise.resolve({}),
      () => clip('ends'),
    );
    speech.configure({ enabled: false, volume: 1, rate: 1 });
    await speech.speak('Oi');
    expect(fallback.spoken).toEqual([]);
  });
});
