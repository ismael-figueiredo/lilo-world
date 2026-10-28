import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { RandomSource } from '@application/ports/random';
import type { Speech } from '@application/ports/speech';
import type { Skill } from '@domain/learning/challenge';
import { ChallengeSession } from '@domain/learning/challenge-session';

/** Opens a learning station at the level the child already reached. */
export class StartChallenge {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly progress: ProgressRepository,
    private readonly speech: Speech,
    private readonly random: RandomSource,
  ) {}

  async execute(skill: Skill): Promise<ChallengeSession> {
    const [words, progress] = await Promise.all([this.catalog.listWords(), this.progress.load()]);
    const session = ChallengeSession.start(skill, progress.levelOf(skill), this.random, words);
    void this.speech.speak(session.challenge.question);
    return session;
  }
}
