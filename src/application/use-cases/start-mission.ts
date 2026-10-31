import type { ContentCatalog } from '@application/ports/content-catalog';
import type { RandomSource } from '@application/ports/random';
import type { Speech } from '@application/ports/speech';
import { MissionAttempt } from '@domain/mission/mission-attempt';
import type { MissionId } from '@domain/mission/mission';
import { prepareMission } from '@domain/mission/prepare-mission';
import { domainError, err, ok, type Result } from '@domain/shared/result';

export class StartMission {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly speech: Speech,
    private readonly random: RandomSource = Math.random,
  ) {}

  async execute(missionId: MissionId): Promise<Result<MissionAttempt>> {
    const mission = await this.catalog.findMission(missionId);
    if (mission === undefined) {
      return err(domainError('not-found', `Mission not found: ${missionId}`));
    }

    // A new variant and shelf every time, so the child does not just repeat taps.
    const attempt = MissionAttempt.start(prepareMission(mission, this.random));
    const firstStep = attempt.currentStep;
    // The prepared mission, not the catalog's: each variant has its own introduction.
    const { introduction } = attempt.mission;
    void this.speech.speak(
      firstStep === undefined ? introduction : `${introduction} ${firstStep.prompt}`,
    );
    return ok(attempt);
  }
}
