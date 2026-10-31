import { describe, expect, it } from 'vitest';
import { QualityGovernor, type Quality } from '@presentation/engine/quality';

const run = (governor: QualityGovernor, fps: number, seconds: number): Quality | undefined => {
  let changed: Quality | undefined;
  for (let i = 0; i < fps * seconds; i += 1) changed = governor.sample(1 / fps) ?? changed;
  return changed;
};

describe('automatic quality', () => {
  it('goes down when the game is slow', () => {
    const governor = new QualityGovernor();
    expect(run(governor, 20, 3.5)).toBe('medium');
    expect(run(governor, 20, 3.5)).toBe('low');
    expect(run(governor, 20, 10)).toBeUndefined();
  });

  it('keeps the quality while the game runs well enough', () => {
    const governor = new QualityGovernor('medium');
    expect(run(governor, 40, 60)).toBeUndefined();
    expect(governor.quality).toBe('medium');
  });

  it('goes up slowly when there is room to spare', () => {
    const governor = new QualityGovernor('low');
    expect(run(governor, 60, 10)).toBeUndefined();
    expect(run(governor, 60, 12)).toBe('medium');
  });

  it('does not go back to a level that was too heavy', () => {
    const governor = new QualityGovernor('high');
    run(governor, 20, 4);
    expect(governor.quality).toBe('medium');
    expect(run(governor, 60, 60)).toBeUndefined();
    expect(governor.quality).toBe('medium');
  });

  it('ignores long frames, such as the tab waking up', () => {
    const governor = new QualityGovernor();
    for (let i = 0; i < 40; i += 1) governor.sample(1);
    expect(governor.quality).toBe('high');
  });
});
