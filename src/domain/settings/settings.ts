import { paces, type Pace, type SkillChoice } from '@domain/curriculum/session-plan';
import { tracks, type Track } from '@domain/curriculum/skill';
import { weathers, type Weather } from '@domain/day/weather';

/** Comfort and sensory settings, one set per child. */
export interface Settings {
  /** 0..1 */
  readonly masterVolume: number;
  readonly voiceVolume: number;
  readonly musicVolume: number;
  readonly effectsVolume: number;
  readonly voiceEnabled: boolean;
  readonly voiceSpeed: VoiceSpeed;
  readonly reducedMotion: boolean;
  readonly softColors: boolean;
  readonly cameraSensitivity: Level;
  readonly worldActivity: WorldActivity;
  readonly showMinimap: boolean;
  /** 0 = no limit. */
  readonly sessionLimitMinutes: SessionLimit;
  /** Skills an adult pinned or hid, by id. */
  readonly skillChoices: Readonly<Record<string, SkillChoice>>;
  /** How hard each track goes, set by an adult. */
  readonly pace: Readonly<Partial<Record<Track, Pace>>>;
  /** 'auto' lets each day have its own weather. */
  readonly fixedWeather: Weather | 'auto';
}

export type VoiceSpeed = 'slow' | 'normal';
export type Level = 'low' | 'normal' | 'high';
export type WorldActivity = 'calm' | 'normal';
export type SessionLimit = 0 | 10 | 15 | 20 | 30;

export const sessionLimits: readonly SessionLimit[] = [0, 10, 15, 20, 30];

export const defaultSettings: Settings = {
  masterVolume: 0.8,
  voiceVolume: 1,
  musicVolume: 0.35,
  effectsVolume: 0.6,
  voiceEnabled: true,
  voiceSpeed: 'normal',
  reducedMotion: false,
  softColors: false,
  cameraSensitivity: 'normal',
  worldActivity: 'normal',
  showMinimap: true,
  sessionLimitMinutes: 10,
  skillChoices: {},
  pace: {},
  fixedWeather: 'auto',
};

const volume = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

const flag = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const oneOf = <T>(options: readonly T[], value: unknown, fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

function paceOf(value: unknown, fallback: Settings['pace']): Settings['pace'] {
  if (value === undefined) return fallback;
  const saved =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    tracks.flatMap((track) =>
      paces.includes(saved[track] as Pace) ? [[track, saved[track]]] : [],
    ),
  );
}

const skillChoices = (value: unknown, fallback: Settings['skillChoices']) =>
  typeof value === 'object' && value !== null
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, SkillChoice] => entry[1] === 'pin' || entry[1] === 'hide',
        ),
      )
    : fallback;

/** Accepts anything (stored data, a UI patch) and returns valid settings. */
export function sanitizeSettings(raw: unknown, base: Settings = defaultSettings): Settings {
  const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    masterVolume: volume(data.masterVolume, base.masterVolume),
    voiceVolume: volume(data.voiceVolume, base.voiceVolume),
    musicVolume: volume(data.musicVolume, base.musicVolume),
    effectsVolume: volume(data.effectsVolume, base.effectsVolume),
    voiceEnabled: flag(data.voiceEnabled, base.voiceEnabled),
    voiceSpeed: oneOf(['slow', 'normal'], data.voiceSpeed, base.voiceSpeed),
    reducedMotion: flag(data.reducedMotion, base.reducedMotion),
    softColors: flag(data.softColors, base.softColors),
    cameraSensitivity: oneOf(
      ['low', 'normal', 'high'],
      data.cameraSensitivity,
      base.cameraSensitivity,
    ),
    worldActivity: oneOf(['calm', 'normal'], data.worldActivity, base.worldActivity),
    showMinimap: flag(data.showMinimap, base.showMinimap),
    sessionLimitMinutes: oneOf(sessionLimits, data.sessionLimitMinutes, base.sessionLimitMinutes),
    skillChoices: skillChoices(data.skillChoices, base.skillChoices),
    pace: paceOf(data.pace, base.pace),
    fixedWeather: oneOf(['auto', ...weathers], data.fixedWeather, base.fixedWeather),
  };
}

export const updateSettings = (current: Settings, patch: Partial<Settings>): Settings =>
  sanitizeSettings({ ...current, ...patch }, current);

/** Final loudness of a channel: the master volume scales every channel. */
export const effectiveVolume = (
  settings: Settings,
  channel: 'voice' | 'music' | 'effects',
): number => {
  const channelVolume = {
    voice: settings.voiceEnabled ? settings.voiceVolume : 0,
    music: settings.musicVolume,
    effects: settings.effectsVolume,
  }[channel];
  return settings.masterVolume * channelVolume;
};
