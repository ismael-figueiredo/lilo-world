import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { RandomSource } from '@application/ports/random';
import type { Speech } from '@application/ports/speech';
import { ActivityRound } from '@domain/activity/activity-round';
import type { PlannedActivity } from '@domain/curriculum/session-plan';
import { skillsAt, type Station } from '@domain/curriculum/skill';

/** After this many mistakes a planned activity ends gently. */
const TIRED_AFTER = 3;

/** Opens an activity at a station. */
export class StartActivity {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly progress: ProgressRepository,
    private readonly speech: Speech,
    private readonly random: RandomSource,
  ) {}

  /** Free practice: the station at the level the child already reached. */
  async execute(station: Station): Promise<ActivityRound> {
    const [words, skills, progress] = await Promise.all([
      this.catalog.listWords(),
      this.catalog.listSkills(),
      this.progress.load(),
    ]);
    const level = Math.min(progress.levelOf(station), this.topLevel(skills, station));
    const round = ActivityRound.start(
      { station, level, skills: skillsAt(skills, station, level) },
      { random: this.random, words },
    );
    void this.speech.speak(round.item.prompt.text);
    return round;
  }

  /** One activity of the day's plan: one skill, a short round. */
  async planned({ skill, length }: PlannedActivity): Promise<ActivityRound> {
    const words = await this.catalog.listWords();
    return ActivityRound.start(
      {
        station: skill.station,
        level: skill.level,
        skills: [skill],
        length,
        maxMistakes: TIRED_AFTER,
      },
      { random: this.random, words },
    );
  }

  /** A partial curriculum (a test, a therapist's catalog) may not reach every level. */
  private topLevel(skills: Parameters<typeof skillsAt>[0], station: Station): number {
    return Math.max(1, ...skills.filter((s) => s.station === station).map((s) => s.level));
  }
}
