/** Short, soft sounds. There is deliberately no "error" sound: mistakes are never punished. */
export type SoundEffect = 'tap' | 'open' | 'close' | 'correct' | 'hint' | 'coin' | 'star' | 'jump';

/** Sounds of the place, under everything else. */
export type Ambience = 'rain' | 'wind' | 'birds' | 'crickets';

export interface AudioVolumes {
  /** 0..1, already multiplied by the master volume. */
  readonly effects: number;
  readonly music: number;
}

/** Sound effects and calm background music. Must never throw. */
export interface AudioPlayer {
  play(effect: SoundEffect): void;
  startMusic(): void;
  stopMusic(): void;
  /** What is heard now. An empty list is silence. */
  setAmbience(sounds: readonly Ambience[]): void;
  setVolumes(volumes: AudioVolumes): void;
}
