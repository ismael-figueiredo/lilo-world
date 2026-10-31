import type { ProgressRepository } from '@application/ports/progress-repository';
import type { DayMemory } from '@domain/progress/player-progress';
import { ALBUM_LETTERS, allStickers, type Sticker } from '@domain/stickers/sticker';

export interface Album {
  readonly stickers: readonly (Sticker & { readonly earned: boolean })[];
  readonly letters: readonly { readonly letter: string; readonly earned: boolean }[];
  /** The days just lived, the latest last. */
  readonly memories: readonly DayMemory[];
}

/** The sticker album and the collectable alphabet for the progress screen. */
export class GetAlbum {
  constructor(private readonly progress: ProgressRepository) {}

  async execute(): Promise<Album> {
    const progress = await this.progress.load();
    const letters = new Set(progress.letters);
    return {
      stickers: allStickers.map((sticker) => ({
        ...sticker,
        earned: progress.hasSticker(sticker.id),
      })),
      letters: ALBUM_LETTERS.map((letter) => ({ letter, earned: letters.has(letter) })),
      memories: progress.memories,
    };
  }
}
