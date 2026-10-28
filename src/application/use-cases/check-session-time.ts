import type { SettingsRepository } from '@application/ports/settings-repository';
import { sessionTimeStatus, type SessionTimeStatus } from '@domain/session/session';

export class CheckSessionTime {
  constructor(private readonly settings: SettingsRepository) {}

  async execute(playedMs: number, inMission: boolean): Promise<SessionTimeStatus> {
    const { sessionLimitMinutes } = await this.settings.load();
    return sessionTimeStatus(sessionLimitMinutes, playedMs, inMission);
  }
}
