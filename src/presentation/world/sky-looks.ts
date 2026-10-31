import type { Phase, Weather } from '@domain/day/weather';

/** How the sky and the light look at one moment. */
export interface SkyLook {
  readonly sun: readonly [number, number, number];
  readonly sunColor: number;
  readonly sunLight: number;
  readonly ambient: number;
  readonly skyTop: number;
  readonly horizon: number;
  readonly disc: number;
  /** 0 in daylight, 1 in the middle of the night. */
  readonly night: number;
}

const phases: Readonly<Record<Phase, SkyLook>> = {
  morning: {
    sun: [0.75, 0.5, 0.42],
    sunColor: 0xffe7c4,
    sunLight: 2.5,
    ambient: 1.7,
    skyTop: 0x5aaef5,
    horizon: 0xfbe6cf,
    disc: 0xfff0c0,
    night: 0,
  },
  noon: {
    sun: [0.3, 0.92, 0.25],
    sunColor: 0xfff3df,
    sunLight: 2.9,
    ambient: 1.9,
    skyTop: 0x3f9cf2,
    horizon: 0xd6f1ff,
    disc: 0xfff6cf,
    night: 0,
  },
  afternoon: {
    sun: [-0.55, 0.75, 0.35],
    sunColor: 0xfff0d8,
    sunLight: 2.8,
    ambient: 1.85,
    skyTop: 0x4aa2f0,
    horizon: 0xe2f0f5,
    disc: 0xfff2c8,
    night: 0,
  },
  dusk: {
    sun: [-0.8, 0.28, 0.5],
    sunColor: 0xffb27a,
    sunLight: 2,
    ambient: 1.2,
    skyTop: 0x5a5fb0,
    horizon: 0xffb58a,
    disc: 0xffb066,
    night: 0.35,
  },
  night: {
    sun: [0.4, 0.8, 0.45],
    sunColor: 0xa9c0ff,
    sunLight: 0.55,
    ambient: 0.62,
    skyTop: 0x101a3f,
    horizon: 0x2a3560,
    disc: 0xf2f4ff,
    night: 1,
  },
};

const GREY_TOP = 0x8795a8;
const GREY_HORIZON = 0xc9d2da;

/** How much each weather hides the sky and takes from the sun. */
const weathers: Readonly<Record<Weather, { readonly grey: number; readonly sun: number }>> = {
  sunny: { grey: 0, sun: 1 },
  wind: { grey: 0.15, sun: 0.9 },
  cold: { grey: 0.35, sun: 0.7 },
  cloudy: { grey: 0.7, sun: 0.5 },
  rain: { grey: 0.9, sun: 0.3 },
};

const mix = (from: number, to: number, amount: number): number => {
  const channel = (shift: number) => {
    const a = (from >> shift) & 255;
    const b = (to >> shift) & 255;
    return Math.round(a + (b - a) * amount) << shift;
  };
  return channel(16) | channel(8) | channel(0);
};

/** The look of the moment: the phase gives the light and the weather softens it. */
export function skyLook(phase: Phase, weather: Weather): SkyLook {
  const look = phases[phase];
  const { grey, sun } = weathers[weather];
  // The night is dark anyway: grey clouds would only make it lighter.
  const veil = grey * (1 - look.night);
  return {
    ...look,
    sunLight: look.sunLight * sun,
    ambient: look.ambient * (1 - veil * 0.38),
    skyTop: mix(look.skyTop, GREY_TOP, veil),
    horizon: mix(look.horizon, GREY_HORIZON, veil),
  };
}
