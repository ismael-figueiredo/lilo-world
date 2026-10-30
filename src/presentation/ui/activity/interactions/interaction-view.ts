import type { Interaction } from '@domain/activity/activity';

/** One way of answering. Every view works with touch, controller and keyboard. */
export interface InteractionView {
  readonly element: HTMLElement;
  /** Shows the answer: only the right way stays active. */
  showAnswer(): void;
  /** A nudge while the child works: what was done stays, and everything stays active. */
  nudge?(): void;
}

export type InteractionFactory<K extends Interaction['kind']> = (
  interaction: Extract<Interaction, { kind: K }>,
  onAnswer: (answerId: string) => void,
) => InteractionView;
