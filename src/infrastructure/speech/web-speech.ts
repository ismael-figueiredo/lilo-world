import type { Speech, SpeechOptions } from '@application/ports/speech';

/**
 * Mascot voice through the browser Web Speech API. Temporary until recorded
 * Portuguese audio exists. Only one phrase plays at a time.
 */
export class WebSpeech implements Speech {
  private options: SpeechOptions = { enabled: true, volume: 1, rate: 0.92 };

  constructor(
    private readonly synth: SpeechSynthesis,
    private readonly createUtterance: (text: string) => SpeechSynthesisUtterance,
    private readonly lang = 'pt-BR',
  ) {}

  configure(options: SpeechOptions): void {
    this.options = options;
    if (!options.enabled || options.volume <= 0) this.stop();
  }

  speak(text: string): Promise<void> {
    if (!this.options.enabled || this.options.volume <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        this.synth.cancel();
        const utterance = this.createUtterance(text);
        utterance.lang = this.lang;
        utterance.rate = this.options.rate;
        utterance.volume = this.options.volume;
        utterance.onend = () => {
          resolve();
        };
        utterance.onerror = () => {
          resolve();
        };
        this.synth.speak(utterance);
      } catch {
        resolve();
      }
    });
  }

  stop(): void {
    try {
      this.synth.cancel();
    } catch {
      // Ignore: stopping speech is best-effort.
    }
  }
}
