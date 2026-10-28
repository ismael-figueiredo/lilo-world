import type { AudioPlayer, AudioVolumes, SoundEffect } from '@application/ports/audio';

interface Note {
  readonly frequency: number;
  readonly delay: number;
  readonly duration: number;
  readonly type: OscillatorType;
  readonly gain: number;
  /** Optional pitch glide target. */
  readonly to?: number;
}

const note = (
  frequency: number,
  delay: number,
  duration: number,
  type: OscillatorType = 'triangle',
  gain = 0.3,
  to?: number,
): Note =>
  to === undefined
    ? { frequency, delay, duration, type, gain }
    : { frequency, delay, duration, type, gain, to };

/**
 * Sound design: short, rounded, major-key sounds. The "hint" sound is a warm
 * major third, so a mistake never sounds like a failure.
 */
const effects: Record<SoundEffect, readonly Note[]> = {
  tap: [note(660, 0, 0.09, 'sine', 0.22)],
  open: [note(523, 0, 0.12, 'triangle', 0.2), note(784, 0.07, 0.16, 'triangle', 0.2)],
  close: [note(784, 0, 0.12, 'triangle', 0.18), note(523, 0.07, 0.16, 'triangle', 0.18)],
  correct: [note(523, 0, 0.14), note(659, 0.09, 0.14), note(784, 0.18, 0.24)],
  hint: [note(440, 0, 0.3, 'sine', 0.2), note(554, 0.12, 0.34, 'sine', 0.18)],
  coin: [note(988, 0, 0.08, 'square', 0.08), note(1319, 0.07, 0.22, 'square', 0.08)],
  star: [
    note(1047, 0, 0.12, 'sine', 0.22),
    note(1319, 0.08, 0.12, 'sine', 0.22),
    note(1568, 0.16, 0.12, 'sine', 0.22),
    note(2093, 0.24, 0.36, 'sine', 0.2),
  ],
  jump: [note(300, 0, 0.16, 'sine', 0.18, 620)],
};

/** C major pentatonic: every combination sounds pleasant and calm. */
const MELODY = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
const CHORDS = [
  [130.81, 196, 261.63],
  [110, 164.81, 220],
  [87.31, 130.81, 174.61],
  [98, 146.83, 196],
];
const BEAT = 60 / 72;

/** Sound effects and a gentle generative background tune, made with Web Audio (no files). */
export class WebAudioPlayer implements AudioPlayer {
  private context: AudioContext | undefined;
  private effectsGain: GainNode | undefined;
  private musicGain: GainNode | undefined;
  private volumes: AudioVolumes = { effects: 0.5, music: 0.3 };
  private musicTimer: number | undefined;
  private nextBeatTime = 0;
  private beat = 0;

  constructor(private readonly createContext: () => AudioContext | undefined) {}

  play(effect: SoundEffect): void {
    const context = this.ensureContext();
    if (context === undefined || this.effectsGain === undefined || this.volumes.effects <= 0)
      return;
    const start = context.currentTime + 0.01;
    for (const n of effects[effect]) this.tone(context, this.effectsGain, n, start);
  }

  startMusic(): void {
    if (this.musicTimer !== undefined) return;
    const context = this.ensureContext();
    if (context === undefined) return;
    this.nextBeatTime = context.currentTime + 0.2;
    this.musicTimer = window.setInterval(() => {
      this.scheduleMusic();
    }, 200);
  }

  stopMusic(): void {
    window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
  }

  setVolumes(volumes: AudioVolumes): void {
    this.volumes = volumes;
    const now = this.context?.currentTime ?? 0;
    this.effectsGain?.gain.setTargetAtTime(volumes.effects, now, 0.05);
    this.musicGain?.gain.setTargetAtTime(volumes.music * 0.5, now, 0.3);
  }

  private ensureContext(): AudioContext | undefined {
    try {
      if (this.context === undefined) {
        const context = this.createContext();
        if (context === undefined) return undefined;
        this.context = context;
        this.effectsGain = context.createGain();
        this.effectsGain.gain.value = this.volumes.effects;
        this.effectsGain.connect(context.destination);

        // Music goes through a soft low-pass filter: no sharp, bright sounds.
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2200;
        filter.connect(context.destination);
        this.musicGain = context.createGain();
        this.musicGain.gain.value = this.volumes.music * 0.5;
        this.musicGain.connect(filter);
      }
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    } catch {
      return undefined;
    }
  }

  private scheduleMusic(): void {
    const context = this.context;
    const gain = this.musicGain;
    if (context === undefined || gain === undefined) return;
    if (this.volumes.music <= 0) {
      this.nextBeatTime = context.currentTime + 0.2;
      return;
    }

    while (this.nextBeatTime < context.currentTime + 0.6) {
      const bar = Math.floor(this.beat / 4) % CHORDS.length;
      const beatInBar = this.beat % 4;
      if (beatInBar === 0) {
        for (const frequency of CHORDS[bar] ?? []) {
          this.tone(context, gain, note(frequency, 0, BEAT * 3.8, 'sine', 0.06), this.nextBeatTime);
        }
      }
      // A simple, repeating (predictable) melody pattern.
      const pattern = [0, 2, 4, 3, 1, 2, 5, 4];
      const step = pattern[(this.beat + bar) % pattern.length] ?? 0;
      if (this.beat % 2 === 0 || beatInBar === 3) {
        const frequency = MELODY[step] ?? MELODY[0] ?? 523.25;
        this.tone(
          context,
          gain,
          note(frequency, 0, BEAT * 1.4, 'triangle', 0.08),
          this.nextBeatTime,
        );
      }
      this.nextBeatTime += BEAT;
      this.beat += 1;
    }
  }

  private tone(context: AudioContext, output: AudioNode, n: Note, start: number): void {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const at = start + n.delay;
    oscillator.type = n.type;
    oscillator.frequency.setValueAtTime(n.frequency, at);
    if (n.to !== undefined)
      oscillator.frequency.exponentialRampToValueAtTime(n.to, at + n.duration);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(n.gain, at + Math.min(0.03, n.duration / 3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + n.duration);
    oscillator.connect(envelope).connect(output);
    oscillator.start(at);
    oscillator.stop(at + n.duration + 0.05);
  }
}
