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
  practiced: 'Agora você viu como é.',
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

    if (outcome.kind === 'model') {
      void this.speech.speak(current.challenge.explanation);
      return { session, outcome, reward: { coins: 0, stars: 0 } };
    }

    const reachedLevel = outcome.summary?.reachedLevel;
    const saved = await this.progress.load();
    const { progress, reward, sticker } = saved.recordChallenge(current.skill, {
      correct: true,
      practice: outcome.kind === 'practiced',
      ...(reachedLevel === undefined ? {} : { reachedLevel }),
      ...(outcome.letter === undefined ? {} : { letter: outcome.letter }),
    });
    await this.progress.save(progress);

    const earned = albumStickers.find((s) => s.id === sticker);
    const praise = [
      outcome.kind === 'correct' ? challengePhrases.correct : challengePhrases.practiced,
      reachedLevel === undefined ? '' : challengePhrases.levelUp,
      earned === undefined ? '' : challengePhrases.sticker,
    ]
      .filter(Boolean)
      .join(' ');
    const next = outcome.summary === undefined ? ` ${session.challenge.question}` : '';
    void this.speech.speak(`${praise}${next}`);
    return earned === undefined
      ? { session, outcome, reward }
      : { session, outcome, reward, sticker: earned };
  }
}
