import type { AudioPlayer } from '@application/ports/audio';
import type { SettingsRepository } from '@application/ports/settings-repository';
import type { Speech } from '@application/ports/speech';
import { effectiveVolume, type Settings } from '@domain/settings/settings';

export const voiceRates = { slow: 0.75, normal: 0.92 } as const;

/** Pushes the child's settings to the sound and voice devices. */
export class ApplySettings {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly audio: AudioPlayer,
    private readonly speech: Speech,
  ) {}

  async execute(): Promise<Settings> {
    const settings = await this.settings.load();
    this.apply(settings);
    return settings;
  }

  apply(settings: Settings): void {
    this.audio.setVolumes({
      effects: effectiveVolume(settings, 'effects'),
      music: effectiveVolume(settings, 'music'),
    });
    this.speech.configure({
      enabled: settings.voiceEnabled,
      volume: effectiveVolume(settings, 'voice'),
      rate: voiceRates[settings.voiceSpeed],
    });
  }
}
