import { describe, expect, it } from 'vitest';
import { outfits } from '@domain/avatar/child';
import { completeStep, firstDay, type DayState, type StepId } from '@domain/day/day-plan';
import {
  comfortIn,
  fitsWeather,
  outfitFor,
  phaseOf,
  weatherOf,
  weathers,
} from '@domain/day/weather';

const after = (...steps: readonly StepId[]): DayState =>
  steps.reduce((day, step) => completeStep(day, step).day, firstDay);

const morning: readonly StepId[] = ['wake', 'eat', 'teeth', 'dress', 'backpack'];

describe('the phases of the day', () => {
  it('follow what the child has done', () => {
    expect(phaseOf(firstDay)).toBe('morning');
    expect(phaseOf(after(...morning))).toBe('morning');
    expect(phaseOf(after(...morning, 'school'))).toBe('noon');
    expect(phaseOf(after(...morning, 'school', 'lunch', 'study'))).toBe('afternoon');
    expect(phaseOf(after(...morning, 'school', 'lunch', 'study', 'outside'))).toBe('dusk');
    expect(
      phaseOf(after(...morning, 'school', 'lunch', 'study', 'outside', 'dinner', 'shower')),
    ).toBe('night');
  });
});

describe('the weather of the day', () => {
  it('starts sunny', () => {
    expect(weatherOf(1, 'ana', 'auto')).toBe('sunny');
  });

  it('is always the same for the same child and day', () => {
    expect(weatherOf(7, 'ana', 'auto')).toBe(weatherOf(7, 'ana', 'auto'));
  });

  it('changes over the days and reaches every kind', () => {
    const seen = new Set(Array.from({ length: 80 }, (_, day) => weatherOf(day + 2, 'ana', 'auto')));
    expect([...seen].sort()).toEqual([...weathers].sort());
  });

  it('lets an adult fix it', () => {
    expect(weatherOf(1, 'ana', 'rain')).toBe('rain');
  });
});

describe('clothes for the weather', () => {
  it('always has something that fits', () => {
    for (const weather of weathers) expect(fitsWeather(weather, outfitFor(weather))).toBe(true);
  });

  it('never suggests pajamas or swimwear for the street', () => {
    for (const weather of weathers) {
      expect(fitsWeather(weather, 'pajamas')).toBe(false);
      expect(fitsWeather(weather, 'swim')).toBe(false);
    }
  });

  it('shows the body cold or wet without the right clothes, and fine with them', () => {
    expect(comfortIn('rain', 'raincoat')).toBe('fine');
    expect(comfortIn('rain', 'home')).toBe('wet');
    expect(comfortIn('cold', 'summer')).toBe('cold');
    expect(comfortIn('cold', 'coat')).toBe('fine');
    expect(comfortIn('wind', 'home')).toBe('cold');
    for (const { id } of outfits) expect(comfortIn('sunny', id)).toBe('fine');
  });
});
