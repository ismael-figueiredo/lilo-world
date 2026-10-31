/** How the child says they are, in pictures. Only the child and their adult ever see it. */
export type Mood = 'great' | 'good' | 'so-so' | 'sad' | 'upset';

export interface MoodNote {
  readonly mood: Mood;
  /** Epoch milliseconds. */
  readonly at: number;
}

export const moods: readonly {
  readonly id: Mood;
  readonly icon: string;
  readonly label: string;
}[] = [
  { id: 'great', icon: '😄', label: 'Muito bem' },
  { id: 'good', icon: '🙂', label: 'Bem' },
  { id: 'so-so', icon: '😐', label: 'Mais ou menos' },
  { id: 'sad', icon: '😢', label: 'Triste' },
  { id: 'upset', icon: '😠', label: 'Chateado' },
];

/** Enough to see how the week went: older notes are forgotten on purpose. */
export const MOODS_KEPT = 14;

export const addMood = (notes: readonly MoodNote[], note: MoodNote): readonly MoodNote[] =>
  [...notes, note].slice(-MOODS_KEPT);

const isNote = (value: unknown): value is MoodNote => {
  if (typeof value !== 'object' || value === null) return false;
  const { mood, at } = value as Record<string, unknown>;
  return moods.some(({ id }) => id === mood) && typeof at === 'number';
};

export function sanitizeMoods(raw: unknown): readonly MoodNote[] {
  return Array.isArray(raw) ? raw.filter(isNote).slice(-MOODS_KEPT) : [];
}
