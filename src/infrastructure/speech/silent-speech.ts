import type { Speech } from '@application/ports/speech';

/** Used when the device has no speech support or the family turned the voice off. */
export class SilentSpeech implements Speech {
  speak(): Promise<void> {
    return Promise.resolve();
  }

  stop(): void {
    // Nothing is ever playing.
  }
}
