import type { Station } from '@domain/curriculum/skill';

export interface StudyLook {
  readonly station: Station;
  readonly icon: string;
  readonly name: string;
  readonly color: string;
}

export const studyLooks: Readonly<Record<Station, StudyLook>> = {
  letters: { station: 'letters', icon: '🔤', name: 'Português', color: '#9b6bf2' },
  numbers: { station: 'numbers', icon: '🔢', name: 'Matemática', color: '#ff8a3d' },
  coins: { station: 'coins', icon: '🪙', name: 'Dinheiro', color: '#e8b10f' },
  world: { station: 'world', icon: '🌎', name: 'O mundo', color: '#3fae5a' },
};
