import type { OutfitId } from '@domain/avatar/child';
import { currentStep, type DayState, type StepId } from '@domain/day/day-plan';

export type Phase = 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night';

export type Weather = 'sunny' | 'cloudy' | 'rain' | 'wind' | 'cold';

export const weathers: readonly Weather[] = ['sunny', 'cloudy', 'rain', 'wind', 'cold'];

/** The sun moves with what the child does, never with a clock: nothing runs out. */
const phases: Readonly<Record<StepId, Phase>> = {
  wake: 'morning',
  eat: 'morning',
  teeth: 'morning',
  dress: 'morning',
  backpack: 'morning',
  school: 'morning',
  lunch: 'noon',
  study: 'noon',
  outside: 'afternoon',
  dinner: 'dusk',
  shower: 'dusk',
  brush: 'night',
  pajamas: 'night',
  sleep: 'night',
};

export function phaseOf(day: DayState): Phase {
  const step = currentStep(day);
  return step === undefined ? 'morning' : phases[step];
}

const hash = (text: string): number => {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
};

/**
 * The same child always has the same weather on the same day. The first day is
 * sunny, so a new player learns the game without anything else to think about.
 * An adult can fix one weather, to practice it or to avoid it.
 */
export function weatherOf(dayNumber: number, seed: string, fixed: Weather | 'auto'): Weather {
  if (fixed !== 'auto') return fixed;
  if (dayNumber <= 1) return 'sunny';
  return weathers[hash(`${seed}:${dayNumber}`) % weathers.length] ?? 'sunny';
}

const fitting: Readonly<Record<Weather, readonly OutfitId[]>> = {
  sunny: ['summer', 'home', 'school'],
  cloudy: ['home', 'school', 'coat'],
  rain: ['raincoat'],
  wind: ['coat', 'raincoat'],
  cold: ['coat'],
};

/** Outside, what fits the weather. Nothing is wrong: this only feeds a gentle tip. */
export const fitsWeather = (weather: Weather, outfit: OutfitId): boolean =>
  fitting[weather].includes(outfit);

export const outfitFor = (weather: Weather): OutfitId => fitting[weather][0] ?? 'home';

export type Comfort = 'fine' | 'wet' | 'cold';

/** How the body feels outside: shown by its posture, and it never costs anything. */
export function comfortIn(weather: Weather, outfit: OutfitId): Comfort {
  if (weather === 'rain') return outfit === 'raincoat' ? 'fine' : 'wet';
  if (weather === 'cold' || weather === 'wind') {
    return outfit === 'coat' || outfit === 'raincoat' ? 'fine' : 'cold';
  }
  return 'fine';
}
