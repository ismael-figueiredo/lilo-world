import type { Ambience, AudioPlayer, AudioVolumes, SoundEffect } from '@application/ports/audio';

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
  // Far away and round: a town's horn, never a warning.
  horn: [note(392, 0, 0.22, 'sine', 0.06), note(494, 0, 0.22, 'sine', 0.05)],
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

/** Rain and wind are filtered noise; birds and crickets are soft, scattered notes. */
const NOISES: Readonly<Partial<Record<Ambience, { frequency: number; gain: number }>>> = {
  rain: { frequency: 1800, gain: 0.16 },
  wind: { frequency: 320, gain: 0.3 },
  street: { frequency: 170, gain: 0 },
};
const ENGINE_GAIN = 0.32;
const CALLS_EVERY_MS = 900;

/** Sound effects and a gentle generative background tune, made with Web Audio (no files). */
export class WebAudioPlayer implements AudioPlayer {
  private context: AudioContext | undefined;
  private effectsGain: GainNode | undefined;
  private musicGain: GainNode | undefined;
  private volumes: AudioVolumes = { effects: 0.5, music: 0.3, ambience: 0.4 };
  private musicTimer: number | undefined;
  private nextBeatTime = 0;
  private beat = 0;
  private ambienceGain: GainNode | undefined;
  private readonly noises = new Map<Ambience, { source: AudioBufferSourceNode; gain: GainNode }>();
  private calls: readonly Ambience[] = [];
  private callsTimer: number | undefined;
  private noiseBuffer: AudioBuffer | undefined;

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
    this.setAmbience([]);
  }

  setAmbience(sounds: readonly Ambience[]): void {
    const context = this.ensureContext();
    if (context === undefined || this.ambienceGain === undefined) return;
    for (const [sound, noise] of this.noises) {
      if (sounds.includes(sound)) continue;
      noise.gain.gain.setTargetAtTime(0, context.currentTime, 0.5);
      noise.source.stop(context.currentTime + 2);
      this.noises.delete(sound);
    }
    for (const sound of sounds) {
      const look = NOISES[sound];
      if (look !== undefined && !this.noises.has(sound)) this.startNoise(context, sound, look);
    }
    this.calls = sounds.filter((sound) => sound === 'birds' || sound === 'crickets');
    window.clearInterval(this.callsTimer);
    if (this.calls.length === 0) return;
    this.callsTimer = window.setInterval(() => {
      this.call();
    }, CALLS_EVERY_MS);
  }

  setStreet(level: number): void {
    const context = this.context;
    const engine = this.noises.get('street');
    if (context === undefined || engine === undefined) return;
    engine.gain.gain.setTargetAtTime(level * ENGINE_GAIN, context.currentTime, 0.4);
  }

  private startNoise(
    context: AudioContext,
    sound: Ambience,
    look: { frequency: number; gain: number },
  ): void {
    if (this.ambienceGain === undefined) return;
    this.noiseBuffer ??= this.createNoise(context);
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = sound === 'rain' ? 'highpass' : 'lowpass';
    filter.frequency.value = look.frequency;
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(look.gain, context.currentTime, 0.8);
    source.connect(filter).connect(gain).connect(this.ambienceGain);
    source.start();
    this.noises.set(sound, { source, gain });
  }

  private createNoise(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** One bird or one cricket, now and then: never a steady pattern to fixate on. */
  private call(): void {
    const context = this.context;
    const output = this.ambienceGain;
    if (context === undefined || output === undefined || Math.random() > 0.45) return;
    const at = context.currentTime + 0.02;
    if (this.calls.includes('birds')) {
      const pitch = 2200 + Math.random() * 900;
      this.tone(context, output, note(pitch, 0, 0.09, 'sine', 0.05, pitch * 1.2), at);
      this.tone(context, output, note(pitch * 1.1, 0.12, 0.09, 'sine', 0.05, pitch), at);
    }
    if (this.calls.includes('crickets')) {
      for (const delay of [0, 0.07, 0.14]) {
        this.tone(context, output, note(4300, delay, 0.04, 'sine', 0.025), at);
      }
    }
  }

  setVolumes(volumes: AudioVolumes): void {
    this.volumes = volumes;
    const now = this.context?.currentTime ?? 0;
    this.effectsGain?.gain.setTargetAtTime(volumes.effects, now, 0.05);
    this.ambienceGain?.gain.setTargetAtTime(volumes.ambience, now, 0.3);
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
        this.ambienceGain = context.createGain();
        this.ambienceGain.gain.value = this.volumes.ambience;
        this.ambienceGain.connect(context.destination);

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
