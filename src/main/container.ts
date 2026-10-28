import type { GameServices } from '@application/game-services';
import type { ContentCatalog } from '@application/ports/content-catalog';
import type { ProgressRepository } from '@application/ports/progress-repository';
import type { Speech } from '@application/ports/speech';
import { BuyWardrobeItem } from '@application/use-cases/buy-wardrobe-item';
import { ChooseMissionAnswer } from '@application/use-cases/choose-mission-answer';
import { GetPlayerProgress } from '@application/use-cases/get-player-progress';
import { GetWardrobe } from '@application/use-cases/get-wardrobe';
import { GetWorldMap } from '@application/use-cases/get-world-map';
import { StartMission } from '@application/use-cases/start-mission';
import { SuggestNextGoal } from '@application/use-cases/suggest-next-goal';
import { ToggleWardrobeItem } from '@application/use-cases/toggle-wardrobe-item';
import { StaticContentCatalog } from '@infrastructure/catalog/static-content-catalog';
import { LocalStorageProgressRepository } from '@infrastructure/persistence/local-storage-progress-repository';
import { SilentSpeech } from '@infrastructure/speech/silent-speech';
import { WebSpeech } from '@infrastructure/speech/web-speech';

export interface Adapters {
  readonly catalog: ContentCatalog;
  readonly progress: ProgressRepository;
  readonly speech: Speech;
}

/** Wires use cases to whatever adapters are given. Tests pass fakes; the browser passes real ones. */
export function createServices({ catalog, progress, speech }: Adapters): GameServices {
  return {
    getPlayerProgress: new GetPlayerProgress(progress),
    getWorldMap: new GetWorldMap(catalog, progress),
    startMission: new StartMission(catalog, speech),
    chooseMissionAnswer: new ChooseMissionAnswer(progress, speech),
    getWardrobe: new GetWardrobe(catalog, progress),
    buyWardrobeItem: new BuyWardrobeItem(catalog, progress),
    toggleWardrobeItem: new ToggleWardrobeItem(catalog, progress),
    suggestNextGoal: new SuggestNextGoal(catalog, progress),
    speech,
  };
}

/** Composition root for the browser. The only place that knows concrete adapters. */
export function createBrowserAdapters(win: Window = window): Adapters {
  return {
    catalog: new StaticContentCatalog(),
    progress: new LocalStorageProgressRepository(safeLocalStorage(win)),
    speech:
      'speechSynthesis' in win
        ? new WebSpeech(win.speechSynthesis, (text) => new SpeechSynthesisUtterance(text))
        : new SilentSpeech(),
  };
}

function safeLocalStorage(win: Window): Storage | undefined {
  try {
    return win.localStorage;
  } catch {
    return undefined;
  }
}
