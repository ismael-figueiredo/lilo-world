import type { ProgressRepository } from '@application/ports/progress-repository';
import { ALBUM_LETTERS, albumStickers, type Sticker } from '@domain/stickers/sticker';

export interface Album {
  readonly stickers: readonly (Sticker & { readonly earned: boolean })[];
  readonly letters: readonly { readonly letter: string; readonly earned: boolean }[];
}

/** The sticker album and the collectable alphabet for the progress screen. */
export class GetAlbum {
  constructor(private readonly progress: ProgressRepository) {}

  async execute(): Promise<Album> {
    const progress = await this.progress.load();
    const letters = new Set(progress.letters);
    return {
      stickers: albumStickers.map((sticker) => ({
        ...sticker,
        earned: progress.hasSticker(sticker.id),
      })),
      letters: ALBUM_LETTERS.map((letter) => ({ letter, earned: letters.has(letter) })),
    };
  }
}
