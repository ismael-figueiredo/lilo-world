import { word } from '@domain/language/word';
import type { AudioPlayer, AudioVolumes, SoundEffect } from '@application/ports/audio';
import type { Clock } from '@application/ports/clock';
import type { IdGenerator } from '@application/ports/id-generator';
import type { Speech, SpeechOptions } from '@application/ports/speech';
import type { WardrobeItem } from '@domain/avatar/wardrobe-item';
import type { Mission } from '@domain/mission/mission';
import type { World } from '@domain/world/world';
import type { GameContent } from '@infrastructure/catalog/static-content-catalog';

export const mission: Mission = {
  id: 'test-market',
  kind: 'pick-items',
  worldId: 'city',
  title: 'Mercado de teste',
  introduction: 'Vamos ao mercado!',
  choices: [
    { id: 'apple', label: 'maçã', pictogram: '🍎' },
    { id: 'milk', label: 'leite', pictogram: '🥛' },
    { id: 'bread', label: 'pão', pictogram: '🍞' },
  ],
  steps: [
    { targetId: 'apple', prompt: 'Pegue a maçã.' },
    { targetId: 'milk', prompt: 'Pegue o leite.' },
  ],
  reward: { coins: 10, stars: 1 },
};

export const hat: WardrobeItem = {
  id: 'hat',
  name: 'Boné',
  slot: 'hat',
  look: 'cap',
  price: 5,
  color: 0xff0000,
};
export const otherHat: WardrobeItem = {
  id: 'hat-2',
  name: 'Chapéu',
  slot: 'hat',
  look: 'cap',
  price: 0,
  color: 0x00ff00,
};
export const expensiveShirt: WardrobeItem = {
  id: 'shirt',
  name: 'Camiseta',
  slot: 'body',
  look: 'color',
  price: 100,
  color: 0x0000ff,
};

export const worlds: readonly World[] = [
  { id: 'city', name: 'Cidade', missionIds: [mission.id], color: 0 },
  { id: 'nature', name: 'Natureza', missionIds: [], color: 0 },
];

export const content: GameContent = {
  worlds,
  missions: [mission],
  wardrobeItems: [hat, otherHat, expensiveShirt],
  avatars: [
    { id: 'robot', name: 'Robô', kind: 'robot', recolorable: true },
    { id: 'bunny', name: 'Coelho', kind: 'animal', recolorable: false },
  ],
  words: [
    word('BO-LA', 'b-o-l-a', '⚽'),
    word('GA-TO', 'g-a-t-o', '🐱'),
    word('PA-TO', 'p-a-t-o', '🦆'),
    word('U-VA', 'u-v-a', '🍇'),
  ],
};

/** Records what the mascot would say. */
export class FakeSpeech implements Speech {
  readonly spoken: string[] = [];
  stopped = 0;

  speak(text: string): Promise<void> {
    this.spoken.push(text);
    return Promise.resolve();
  }

  stop(): void {
    this.stopped += 1;
  }

  options: SpeechOptions | undefined;

  configure(options: SpeechOptions): void {
    this.options = options;
  }
}

export class FakeAudio implements AudioPlayer {
  readonly played: SoundEffect[] = [];
  volumes: AudioVolumes | undefined;
  musicOn = false;

  play(effect: SoundEffect): void {
    this.played.push(effect);
  }

  startMusic(): void {
    this.musicOn = true;
  }

  stopMusic(): void {
    this.musicOn = false;
  }

  setStreet(): void {
    // Nothing to play.
  }

  setAmbience(): void {
    // Nothing to record.
  }

  setVolumes(volumes: AudioVolumes): void {
    this.volumes = volumes;
  }
}

export class FixedClock implements Clock {
  constructor(public time = 1_000) {}

  now(): number {
    return this.time;
  }
}

export class SequentialIds implements IdGenerator {
  private count = 0;

  next(): string {
    this.count += 1;
    return `id-${this.count}`;
  }
}
