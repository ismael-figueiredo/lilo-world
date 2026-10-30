/** A word the child knows from pictures, in capital letters (as taught in early literacy). */
export interface Word {
  readonly text: string;
  /** Spoken parts: BO, LA. */
  readonly syllables: readonly string[];
  /** Sounds, not letters: CASA is k-a-z-a. */
  readonly sounds: readonly string[];
  readonly pictogram: string;
  /** Path of a reviewed ARASAAC pictogram, when there is one. */
  readonly image?: string;
  /** Themes the child can choose, like animals or toys. */
  readonly tags: readonly string[];
}

/** One line per word: `word('BO-LA', 'b-o-l-a', '⚽', ['toys'])`. */
export const word = (
  spelled: string,
  sounds: string,
  pictogram: string,
  tags: readonly string[] = [],
): Word => {
  const syllables = spelled.split('-');
  return {
    text: syllables.join(''),
    syllables,
    sounds: sounds.split('-'),
    pictogram,
    tags,
  };
};

/** First letter without accent marks: ÁRVORE starts with A. */
export const firstLetter = (text: string): string => text.normalize('NFD').charAt(0).toUpperCase();
