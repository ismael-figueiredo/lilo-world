import type { Clock } from '@application/ports/clock';
import type { MoodRepository } from '@application/ports/mood-repository';
import { addMood, type Mood, type MoodNote } from '@domain/feelings/mood';

/** "How am I?": one press, at any time. */
export class NoteMood {
  constructor(
    private readonly moods: MoodRepository,
    private readonly clock: Clock,
  ) {}

  async execute(mood: Mood): Promise<void> {
    const notes = await this.moods.load();
    await this.moods.save(addMood(notes, { mood, at: this.clock.now() }));
  }

  list(): Promise<readonly MoodNote[]> {
    return this.moods.load();
  }
}
