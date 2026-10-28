import type { Speech } from '@application/ports/speech';

/** Used when the device has no speech support. */
export class SilentSpeech implements Speech {
  speak(): Promise<void> {
    return Promise.resolve();
  }

  stop(): void {
    // Nothing is ever playing.
  }

  configure(): void {
    // Nothing to configure.
  }
}
