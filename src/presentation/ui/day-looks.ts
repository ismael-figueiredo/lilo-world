import type { StepId } from '@domain/day/day-plan';
import type { SchoolThing } from '@domain/day/day-plan';

/** Each step of the day as a picture and a word. */
export const stepLooks: Readonly<Record<StepId, { icon: string; name: string }>> = {
  wake: { icon: '🌅', name: 'Acordar' },
  eat: { icon: '🥣', name: 'Comer' },
  teeth: { icon: '🪥', name: 'Escovar os dentes' },
  dress: { icon: '👕', name: 'Vestir a roupa' },
  backpack: { icon: '🎒', name: 'Arrumar a mochila' },
  school: { icon: '🏫', name: 'Escola' },
  lunch: { icon: '🍲', name: 'Almoço' },
  study: { icon: '✏️', name: 'Estudar' },
  outside: { icon: '🌳', name: 'Sair na rua' },
  shower: { icon: '🚿', name: 'Tomar banho' },
  pajamas: { icon: '🌙', name: 'Vestir o pijama' },
  sleep: { icon: '🛏️', name: 'Dormir' },
};

export const schoolThingLooks: Readonly<Record<SchoolThing, { icon: string; name: string }>> = {
  notebook: { icon: '📓', name: 'Caderno' },
  pencil: { icon: '✏️', name: 'Lápis' },
  book: { icon: '📕', name: 'Livro' },
  lunchbox: { icon: '🍱', name: 'Lancheira' },
  sneakers: { icon: '👟', name: 'Tênis' },
  paints: { icon: '🎨', name: 'Tintas' },
};
