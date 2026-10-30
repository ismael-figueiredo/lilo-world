import { phrases } from '@application/phrases';
import type { Clock } from '@application/ports/clock';
import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { RandomSource } from '@application/ports/random';
import type { Speech } from '@application/ports/speech';
import type { ActivityOutcome, ActivityRound } from '@domain/activity/activity-round';
import type { Reward } from '@domain/reward/reward';
import { albumStickers, type Sticker } from '@domain/stickers/sticker';

export interface AnswerActivityResult {
  readonly round: ActivityRound;
  readonly outcome: ActivityOutcome;
  readonly reward: Reward;
  /** A sticker earned with this answer (first right answer, or a new level). */
  readonly sticker?: Sticker;
}

export class AnswerActivity {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly progress: ProgressRepository,
    private readonly speech: Speech,
    private readonly random: RandomSource,
    private readonly clock: Clock,
  ) {}

  async execute(current: ActivityRound, answerId: string): Promise<AnswerActivityResult> {
    const words = await this.catalog.listWords();
    const { round, outcome } = current.answer(answerId, { random: this.random, words });

    if (outcome.kind === 'model') {
      void this.speech.speak(current.item.teach.text);
      return { round, outcome, reward: { coins: 0, stars: 0 } };
    }

    const reachedLevel = outcome.summary?.reachedLevel;
    const saved = await this.progress.load();
    const { progress, reward, sticker } = saved.recordChallenge(current.station, {
      correct: true,
      practice: outcome.kind === 'practiced',
      ...(reachedLevel === undefined ? {} : { reachedLevel }),
      ...(outcome.letter === undefined ? {} : { letter: outcome.letter }),
    });
    // A demonstration or a returning question says nothing about what the child knows.
    const counts = !current.isRetry && !current.isDemonstration;
    await this.progress.save(
      counts
        ? progress.recordSkill(current.item.skillId, outcome.kind === 'correct', this.clock.now())
        : progress,
    );

    const earned = albumStickers.find((s) => s.id === sticker);
    const praise = [
      outcome.kind === 'correct' ? phrases.correct : phrases.practiced,
      reachedLevel === undefined ? '' : phrases.levelUp,
      earned === undefined ? '' : phrases.sticker,
    ]
      .filter(Boolean)
      .join(' ');
    // Only the praise: the next question is said when it appears on the screen.
    void this.speech.speak(praise);
    return earned === undefined
      ? { round, outcome, reward }
      : { round, outcome, reward, sticker: earned };
  }
}
