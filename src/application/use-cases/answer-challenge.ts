import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { RandomSource } from '@application/ports/random';
import type { Speech } from '@application/ports/speech';
import type { ChallengeOutcome, ChallengeSession } from '@domain/learning/challenge-session';
import type { Reward } from '@domain/reward/reward';
import { albumStickers, type Sticker } from '@domain/stickers/sticker';

export interface AnswerChallengeResult {
  readonly session: ChallengeSession;
  readonly outcome: ChallengeOutcome;
  readonly reward: Reward;
  /** A sticker earned with this answer (first right answer, or a new level). */
  readonly sticker?: Sticker;
}

/** Warm and short. A wrong answer is never called "wrong". */
export const challengePhrases = {
  correct: 'Isso!',
  levelUp: 'Você subiu de nível!',
  sticker: 'Ganhou uma figurinha!',
  hint: 'Vamos tentar de novo.',
} as const;

export class AnswerChallenge {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly progress: ProgressRepository,
    private readonly speech: Speech,
    private readonly random: RandomSource,
  ) {}

  async execute(current: ChallengeSession, optionId: string): Promise<AnswerChallengeResult> {
    const words = await this.catalog.listWords();
    const { session, outcome } = current.answer(optionId, this.random, words);

    if (outcome.kind === 'hint') {
      void this.speech.speak(`${challengePhrases.hint} ${current.challenge.question}`);
      return { session, outcome, reward: { coins: 0, stars: 0 } };
    }

    const saved = await this.progress.load();
    const { progress, reward, sticker } = saved.recordChallenge(current.skill, {
      correct: true,
      ...(outcome.reachedLevel === undefined ? {} : { reachedLevel: outcome.reachedLevel }),
      ...(outcome.letter === undefined ? {} : { letter: outcome.letter }),
    });
    await this.progress.save(progress);

    const earned = albumStickers.find((s) => s.id === sticker);
    const praise = [
      challengePhrases.correct,
      outcome.reachedLevel === undefined ? '' : challengePhrases.levelUp,
      earned === undefined ? '' : challengePhrases.sticker,
    ]
      .filter(Boolean)
      .join(' ');
    void this.speech.speak(`${praise} ${session.challenge.question}`);
    return earned === undefined
      ? { session, outcome, reward }
      : { session, outcome, reward, sticker: earned };
  }
}
