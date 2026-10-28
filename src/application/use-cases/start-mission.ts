import type { ContentCatalog } from '@application/ports/content-catalog';
import type { Speech } from '@application/ports/speech';
import { MissionAttempt } from '@domain/mission/mission-attempt';
import type { MissionId } from '@domain/mission/mission';
import { domainError, err, ok, type Result } from '@domain/shared/result';

export class StartMission {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly speech: Speech,
  ) {}

  async execute(missionId: MissionId): Promise<Result<MissionAttempt>> {
    const mission = await this.catalog.findMission(missionId);
    if (mission === undefined) {
      return err(domainError('not-found', `Mission not found: ${missionId}`));
    }

    const attempt = MissionAttempt.start(mission);
    const firstStep = attempt.currentStep;
    void this.speech.speak(
      firstStep === undefined
        ? mission.introduction
        : `${mission.introduction} ${firstStep.prompt}`,
    );
    return ok(attempt);
  }
}
