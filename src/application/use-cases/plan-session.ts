import type { Clock } from '@application/ports/clock';
import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { SettingsRepository } from '@application/ports/settings-repository';
import { needsHelp, skillStatus, type SkillStatus } from '@domain/curriculum/mastery';
import {
  planSession,
  type PlannedActivity,
  type SkillChoice,
} from '@domain/curriculum/session-plan';
import type { SkillDefinition } from '@domain/curriculum/skill';
import type { MoneyLevel } from '@domain/errand/errand';

/** Coins for finishing the day's plan, whatever happened along the way. */
export const SESSION_COINS = 5;

/** One line of the adults' summary. */
export interface SkillOverview {
  readonly skill: SkillDefinition;
  readonly status: SkillStatus;
  readonly needsHelp: boolean;
  readonly choice?: SkillChoice;
}

/** Today's activities, from what the child already knows and what an adult chose. */
export class PlanSession {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly progress: ProgressRepository,
    private readonly settings: SettingsRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<PlannedActivity[]> {
    const [skills, progress, settings] = await Promise.all([
      this.catalog.listSkills(),
      this.progress.load(),
      this.settings.load(),
    ]);
    const now = this.clock.now();
    return planSession({
      skills,
      statusOf: (id) => skillStatus(progress.skillRecord(id), now),
      choices: settings.skillChoices,
      pace: settings.pace,
    });
  }

  /** The money of the lunch task follows what the child already does in math. */
  async moneyLevel(): Promise<MoneyLevel> {
    const progress = await this.progress.load();
    const now = this.clock.now();
    const knows = (id: string) =>
      ['mastered', 'review'].includes(skillStatus(progress.skillRecord(id), now));
    if (knows('math.cash.3')) return 'cents';
    return knows('math.cash.2') ? 'change' : 'exact';
  }

  /** For the adults' area: where each skill stands. */
  async overview(): Promise<SkillOverview[]> {
    const [skills, progress, settings] = await Promise.all([
      this.catalog.listSkills(),
      this.progress.load(),
      this.settings.load(),
    ]);
    const now = this.clock.now();
    return skills.map((skill) => {
      const record = progress.skillRecord(skill.id);
      const choice = settings.skillChoices[skill.id];
      return {
        skill,
        status: skillStatus(record, now),
        needsHelp: needsHelp(record),
        ...(choice === undefined ? {} : { choice }),
      };
    });
  }

  async finish(): Promise<void> {
    await this.progress.save((await this.progress.load()).rewardSession(SESSION_COINS));
  }
}
