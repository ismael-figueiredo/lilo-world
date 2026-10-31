import type { ProgressRepository } from '@application/ports/progress-repository';
import { beachStickerId } from '@domain/stickers/sticker';

/** What was made at the beach stays in the album. */
export class KeepBeachMemory {
  constructor(private readonly progress: ProgressRepository) {}

  async execute(memory: 'castle'): Promise<void> {
    const progress = await this.progress.load();
    await this.progress.save(progress.withSticker(beachStickerId(memory)));
  }
}
