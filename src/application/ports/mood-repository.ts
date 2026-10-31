import type { MoodNote } from '@domain/feelings/mood';

/** Moods of one child. They stay on this device, and nothing sends them anywhere. */
export interface MoodRepository {
  load(): Promise<readonly MoodNote[]>;
  save(notes: readonly MoodNote[]): Promise<void>;
}
