/** The mascot's voice. Implementations must never throw: speech is a helper, not a requirement. */
export interface Speech {
  speak(text: string): Promise<void>;
  stop(): void;
}
