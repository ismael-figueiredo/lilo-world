import type { Speech, SpeechOptions } from '@application/ports/speech';

/** The sound of one recording: the part of an audio element used here. */
export type VoiceClip = Pick<HTMLAudioElement, 'volume' | 'play' | 'pause' | 'onended' | 'onerror'>;

/** Recorded phrases, by their exact text, with the name of each file. */
export type VoiceManifest = Readonly<Record<string, string>>;

/**
 * Plays a recording when there is one, and asks the synthetic voice otherwise:
 * phrases can be recorded a few at a time, and a file that fails never leaves
 * the child without the sentence.
 */
export class RecordedSpeech implements Speech {
  private options: SpeechOptions = { enabled: true, volume: 1, rate: 0.92 };
  private clip: VoiceClip | undefined;

  constructor(
    private readonly fallback: Speech,
    private readonly manifest: () => Promise<VoiceManifest>,
    private readonly createClip: (file: string) => VoiceClip,
  ) {}

  configure(options: SpeechOptions): void {
    this.options = options;
    this.fallback.configure(options);
    if (!options.enabled || options.volume <= 0) this.stop();
  }

  async speak(text: string): Promise<void> {
    if (!this.options.enabled || this.options.volume <= 0) return;
    const file = (await this.manifest())[text];
    if (file === undefined) {
      await this.fallback.speak(text);
      return;
    }
    this.stop();
    await this.play(file, text);
  }

  private play(file: string, text: string): Promise<void> {
    return new Promise((resolve) => {
      const clip = this.createClip(file);
      this.clip = clip;
      clip.volume = this.options.volume;
      clip.onended = () => {
        resolve();
      };
      const useTheOtherVoice = () => {
        void this.fallback.speak(text).then(resolve);
      };
      clip.onerror = useTheOtherVoice;
      clip.play().catch(useTheOtherVoice);
    });
  }

  stop(): void {
    this.clip?.pause();
    this.clip = undefined;
    this.fallback.stop();
  }
}
