export interface SpeechOptions {
  readonly enabled: boolean;
  /** 0..1 */
  readonly volume: number;
  /** Speaking rate multiplier (1 = normal). */
  readonly rate: number;
}

/** The mascot's voice. Implementations must never throw: speech is a helper, not a requirement. */
export interface Speech {
  speak(text: string): Promise<void>;
  stop(): void;
  configure(options: SpeechOptions): void;
}
