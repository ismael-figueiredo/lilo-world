import { describe, expect, it } from 'vitest';
import { skyLook } from '@presentation/world/sky-looks';

describe('the look of the sky', () => {
  it('is darkest at night, with stars out', () => {
    expect(skyLook('night', 'sunny').sunLight).toBeLessThan(skyLook('noon', 'sunny').sunLight);
    expect(skyLook('night', 'sunny').night).toBe(1);
    expect(skyLook('noon', 'sunny').night).toBe(0);
  });

  it('takes light away on grey days', () => {
    expect(skyLook('noon', 'rain').sunLight).toBeLessThan(skyLook('noon', 'cloudy').sunLight);
    expect(skyLook('noon', 'rain').skyTop).not.toBe(skyLook('noon', 'sunny').skyTop);
  });

  it('keeps the night dark whatever the weather', () => {
    expect(skyLook('night', 'rain').skyTop).toBe(skyLook('night', 'sunny').skyTop);
  });
});
