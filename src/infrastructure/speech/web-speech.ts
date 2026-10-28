import type { Speech } from '@application/ports/speech';

export interface WebSpeechOptions {
  readonly lang: string;
  /** Slightly slower than default: calmer and easier to follow. */
  readonly rate: number;
}

const defaults: WebSpeechOptions = { lang: 'pt-BR', rate: 0.9 };

/**
 * Mascot voice through the browser Web Speech API. Temporary until recorded
 * Portuguese audio exists. Only one phrase plays at a time.
 */
export class WebSpeech implements Speech {
  private readonly options: WebSpeechOptions;

  constructor(
    private readonly synth: SpeechSynthesis,
    private readonly createUtterance: (text: string) => SpeechSynthesisUtterance,
    options: Partial<WebSpeechOptions> = {},
  ) {
    this.options = { ...defaults, ...options };
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        this.synth.cancel();
        const utterance = this.createUtterance(text);
        utterance.lang = this.options.lang;
        utterance.rate = this.options.rate;
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
