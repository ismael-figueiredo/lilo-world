import type { ProgressRepository } from '@application/ports/progress-repository';
import { animalStickerId, type StickerId } from '@domain/stickers/sticker';
import type { AnimalId } from '@domain/zoo/animals';

/** The first time near an animal puts it in the notebook. */
export class MeetAnimal {
  constructor(private readonly progress: ProgressRepository) {}

  async execute(animal: AnimalId): Promise<StickerId | undefined> {
    const progress = await this.progress.load();
    const sticker = animalStickerId(animal);
    if (progress.hasSticker(sticker)) return undefined;
    await this.progress.save(progress.withSticker(sticker));
    return sticker;
  }
}
