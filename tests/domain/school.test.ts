import { describe, expect, it } from 'vitest';
import { BUS_START, busComing, rideSeconds, stepBus, type Bus } from '@domain/city/bus';
import { completeStep, firstDay, sanitizeDay, type DayState } from '@domain/day/day-plan';
import {
  afterAsking,
  firstSchoolStage,
  isSchoolStage,
  lineAfter,
  nextSchoolStage,
} from '@domain/school/school-day';

const DT = 1 / 30;

describe('the bus', () => {
  it('stops exactly at the sign, and waits there as long as it takes', () => {
    let bus: Bus = busComing;
    for (let t = 0; t < 30; t += DT) bus = stepBus(bus, -9, false, DT);
    expect(bus).toEqual({ state: 'stopped', x: -9, speed: 0 });
    expect(stepBus(bus, -9, false, 100)).toEqual(bus);
  });

  it('leaves when told to, and is gone at the end of the street', () => {
    let bus: Bus = { state: 'stopped', x: -9, speed: 0 };
    for (let t = 0; t < 60; t += DT) bus = stepBus(bus, -9, true, DT);
    expect(bus.state).toBe('gone');
    expect(bus.x).toBeLessThan(BUS_START);
  });

  it('takes the promised time, and a short one when an adult asks', () => {
    expect(rideSeconds(false)).toBeGreaterThanOrEqual(20);
    expect(rideSeconds(false)).toBeLessThanOrEqual(40);
    expect(rideSeconds(true)).toBeLessThan(10);
  });
});

describe('the school agenda', () => {
  it('goes from the stop to leaving, and stays at the end', () => {
    expect(firstSchoolStage).toBe('stop');
    expect(nextSchoolStage('stop')).toBe('ride');
    expect(nextSchoolStage('leave')).toBe('leave');
  });

  it('answers every need, and only the bathroom has a way to walk', () => {
    expect(afterAsking('toilet')).toBe('toilet');
    expect(afterAsking('help')).toBe('snack');
    expect(afterAsking('water')).toBe('snack');
  });

  it('moves the line one place at a time, never below zero', () => {
    expect(lineAfter(2)).toBe(1);
    expect(lineAfter(0)).toBe(0);
  });

  it('is saved with the day and ends when school does', () => {
    expect(isSchoolStage('snack')).toBe(true);
    const day: DayState = {
      ...firstDay,
      done: ['wake', 'eat', 'teeth', 'dress', 'backpack'],
      school: 'snack',
    };
    expect(sanitizeDay(JSON.parse(JSON.stringify(day))).school).toBe('snack');
    expect(sanitizeDay({ ...day, school: 'nap' }).school).toBeUndefined();
    expect(completeStep(day, 'school').day.school).toBeUndefined();
  });
});
