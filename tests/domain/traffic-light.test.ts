import { describe, expect, it } from 'vitest';
import { TRAFFIC_CYCLE, trafficPhase } from '@domain/city/traffic-light';

describe('traffic light', () => {
  const { carsGreen, carsYellow, carsRed, margin } = TRAFFIC_CYCLE;
  const cycle = carsGreen + carsYellow + carsRed;

  it('goes green, yellow, red for cars', () => {
    expect(trafficPhase(0).cars).toBe('green');
    expect(trafficPhase(carsGreen + 0.1).cars).toBe('yellow');
    expect(trafficPhase(carsGreen + carsYellow + 0.1).cars).toBe('red');
    expect(trafficPhase(cycle + 0.1).cars).toBe('green');
  });

  it('never lets people walk while cars may move', () => {
    for (let t = 0; t < cycle * 2; t += 0.1) {
      const phase = trafficPhase(t);
      if (phase.walk) expect(phase.cars).toBe('red');
    }
  });

  it('gives people a safe walking time inside the red light', () => {
    const redStart = carsGreen + carsYellow;
    expect(trafficPhase(redStart + 0.1).walk).toBe(false);
    expect(trafficPhase(redStart + margin + 0.1).walk).toBe(true);
    expect(trafficPhase(cycle - 0.1).walk).toBe(false);
  });

  it('counts down to the next change', () => {
    expect(trafficPhase(1).secondsLeft).toBeCloseTo(carsGreen - 1);
    expect(trafficPhase(-1).cars).toBe('red');
  });
});
