import { describe, expect, it } from 'vitest';
import { NoteMood } from '@application/use-cases/note-mood';
import { addMood, MOODS_KEPT, sanitizeMoods, type MoodNote } from '@domain/feelings/mood';
import { feelingScenes, namingChoices, sceneOfDay } from '@domain/feelings/scenes';
import { defaultSettings } from '@domain/settings/settings';
import { InMemoryMoodRepository } from '@infrastructure/persistence/in-memory-repositories';
import { FixedClock } from '../support/fixtures';

describe('feeling scenes', () => {
  it('are off until a professional has reviewed them', () => {
    expect(defaultSettings.feelingScenes).toBe(false);
  });

  it('are twelve, each with its own id, a clear contrast and something that helps', () => {
    expect(feelingScenes).toHaveLength(12);
    expect(new Set(feelingScenes.map((scene) => scene.id)).size).toBe(12);
    for (const scene of feelingScenes) {
      expect(scene.other, scene.id).not.toBe(scene.feeling);
      expect(scene.helps.length, scene.id).toBeGreaterThan(0);
      expect(new Set(scene.helps.map((help) => help.id)).size, scene.id).toBe(scene.helps.length);
    }
  });

  it('show the body without giving the name of the feeling away', () => {
    for (const scene of feelingScenes) {
      expect(scene.body.toLowerCase(), scene.id).not.toMatch(/triste|feliz|raiva|medo|surpres/);
      expect(scene.happens.toLowerCase(), scene.id).not.toMatch(/triste|feliz|raiva|medo/);
    }
  });

  it('go around all the scenes, one each day', () => {
    const seen = new Set(
      Array.from({ length: 12 }, (_, day) => sceneOfDay(day + 1, feelingScenes).id),
    );
    expect(seen.size).toBe(12);
    expect(sceneOfDay(13, feelingScenes)).toBe(sceneOfDay(1, feelingScenes));
  });

  it('offer both faces in either order', () => {
    const scene = feelingScenes[0];
    if (scene === undefined) throw new Error('No scene');
    expect(namingChoices(scene, () => 0)).not.toEqual(namingChoices(scene, () => 0.9));
    expect([...namingChoices(scene, () => 0)].sort()).toEqual([scene.feeling, scene.other].sort());
  });
});

describe('how I am', () => {
  it('keeps only the latest notes', () => {
    let notes: readonly MoodNote[] = [];
    for (let at = 0; at < MOODS_KEPT + 5; at += 1) notes = addMood(notes, { mood: 'good', at });
    expect(notes).toHaveLength(MOODS_KEPT);
    expect(notes.at(-1)?.at).toBe(MOODS_KEPT + 4);
  });

  it('survives a broken save', () => {
    expect(sanitizeMoods('nope')).toEqual([]);
    expect(sanitizeMoods([{ mood: 'good', at: 1 }, { mood: 'x', at: 2 }, null])).toEqual([
      { mood: 'good', at: 1 },
    ]);
  });

  it('is saved with one press', async () => {
    const note = new NoteMood(new InMemoryMoodRepository(), new FixedClock(9));
    await note.execute('great');
    await expect(note.list()).resolves.toEqual([{ mood: 'great', at: 9 }]);
  });
});
