import { describe, expect, it } from 'vitest';
import {
  createProfile,
  normalizeName,
  renameProfile,
  sortProfiles,
} from '@domain/profile/player-profile';
import { sanitizeSession, sessionTimeStatus } from '@domain/session/session';
import {
  defaultSettings,
  effectiveVolume,
  sanitizeSettings,
  updateSettings,
} from '@domain/settings/settings';

describe('player profile', () => {
  it('normalizes names and rejects empty or too long ones', () => {
    expect(normalizeName('  Ana   Clara ')).toEqual({ ok: true, value: 'Ana Clara' });
    expect(normalizeName('   ').ok).toBe(false);
    expect(normalizeName('x'.repeat(21)).ok).toBe(false);
  });

  it('creates and renames profiles', () => {
    const created = createProfile('p1', 'Leo', 'robot', 10);
    expect(created).toEqual({
      ok: true,
      value: { id: 'p1', name: 'Leo', avatarId: 'robot', createdAt: 10, lastPlayedAt: 10 },
    });
    if (!created.ok) return;
    expect(
      renameProfile(created.value, 'Léo').ok && renameProfile(created.value, 'Léo'),
    ).toMatchObject({
      value: { name: 'Léo' },
    });
    expect(renameProfile(created.value, '').ok).toBe(false);
    expect(createProfile('p2', '', 'robot', 1).ok).toBe(false);
  });

  it('lists the most recently played first', () => {
    const a = { id: 'a', name: 'A', avatarId: 'robot', createdAt: 0, lastPlayedAt: 5 };
    const b = { id: 'b', name: 'B', avatarId: 'robot', createdAt: 0, lastPlayedAt: 9 };
    expect(sortProfiles([a, b]).map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('settings', () => {
  it('repairs broken stored values', () => {
    const settings = sanitizeSettings({
      masterVolume: 3,
      musicVolume: -1,
      voiceSpeed: 'turbo',
      sessionLimitMinutes: 12,
      softColors: 'yes',
    });
    expect(settings.masterVolume).toBe(1);
    expect(settings.musicVolume).toBe(0);
    expect(settings.voiceSpeed).toBe(defaultSettings.voiceSpeed);
    expect(settings.sessionLimitMinutes).toBe(0);
    expect(settings.softColors).toBe(false);
    expect(sanitizeSettings(null)).toEqual(defaultSettings);
  });

  it('applies a partial change', () => {
    const next = updateSettings(defaultSettings, { reducedMotion: true, sessionLimitMinutes: 15 });
    expect(next).toMatchObject({ reducedMotion: true, sessionLimitMinutes: 15 });
    expect(next.masterVolume).toBe(defaultSettings.masterVolume);
  });

  it('scales every channel by the master volume and mutes a disabled voice', () => {
    const settings = { ...defaultSettings, masterVolume: 0.5, musicVolume: 0.4 };
    expect(effectiveVolume(settings, 'music')).toBeCloseTo(0.2);
    expect(effectiveVolume({ ...settings, voiceEnabled: false }, 'voice')).toBe(0);
  });
});

describe('session', () => {
  it('accepts valid positions and rejects broken ones', () => {
    const state = { x: 1, y: 2, z: 3, facing: 0, cameraYaw: 1, savedAt: 9 };
    expect(sanitizeSession(state)).toEqual(state);
    expect(sanitizeSession({ ...state, savedAt: 'x' })).toEqual({ ...state, savedAt: 0 });
    expect(sanitizeSession({ ...state, x: Number.NaN })).toBeUndefined();
    expect(sanitizeSession('nope')).toBeUndefined();
  });

  it('counts down, warns before the end and never stops a mission halfway', () => {
    const minute = 60_000;
    expect(sessionTimeStatus(0, 99 * minute, false)).toEqual({ kind: 'free' });
    expect(sessionTimeStatus(15, 5 * minute, false)).toEqual({ kind: 'counting', minutesLeft: 10 });
    expect(sessionTimeStatus(15, 13 * minute, false)).toEqual({
      kind: 'last-mission',
      minutesLeft: 2,
    });
    expect(sessionTimeStatus(15, 16 * minute, true)).toEqual({
      kind: 'last-mission',
      minutesLeft: 0,
    });
    expect(sessionTimeStatus(15, 16 * minute, false)).toEqual({ kind: 'time-to-rest' });
  });
});
