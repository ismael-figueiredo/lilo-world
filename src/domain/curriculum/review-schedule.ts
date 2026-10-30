export const DAY_MS = 86_400_000;

/** Days until a mastered skill comes back: more each time it is remembered. */
export const REVIEW_DAYS: readonly number[] = [1, 3, 7, 21];

/** The next step after a review: forward when remembered, one back when not. */
export const nextReviewStep = (step: number, remembered: boolean): number =>
  remembered ? Math.min(step + 1, REVIEW_DAYS.length - 1) : Math.max(step - 1, 0);

export const reviewAt = (now: number, step: number): number =>
  now + (REVIEW_DAYS[step] ?? 1) * DAY_MS;
