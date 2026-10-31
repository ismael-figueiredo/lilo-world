import type { AudioPlayer } from '@application/ports/audio';

/** Used when Web Audio is not available. */
export class SilentAudio implements AudioPlayer {
  play(): void {
    // No sound.
  }

  startMusic(): void {
    // No sound.
  }

  stopMusic(): void {
    // No sound.
  }

  setStreet(): void {
    // Nothing to play.
  }

  setAmbience(): void {
    // No sound.
  }

  setVolumes(): void {
    // No sound.
  }
}
