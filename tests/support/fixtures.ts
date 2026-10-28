import type { Speech } from '@application/ports/speech';
import type { WardrobeItem } from '@domain/avatar/wardrobe-item';
import type { Mission } from '@domain/mission/mission';
import type { World } from '@domain/world/world';
import type { GameContent } from '@infrastructure/catalog/static-content-catalog';

export const mission: Mission = {
  id: 'test-market',
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
  { id: 'city', name: 'Cidade', requiredStars: 0, missionIds: [mission.id], color: 0 },
  { id: 'nature', name: 'Natureza', requiredStars: 3, missionIds: [], color: 0 },
];

export const content: GameContent = {
  worlds,
  missions: [mission],
  wardrobeItems: [hat, otherHat, expensiveShirt],
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
}
