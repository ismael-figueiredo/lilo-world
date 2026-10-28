import type { Speech } from '@application/ports/speech';
import type { BuyWardrobeItem } from '@application/use-cases/buy-wardrobe-item';
import type { ChooseMissionAnswer } from '@application/use-cases/choose-mission-answer';
import type { GetPlayerProgress } from '@application/use-cases/get-player-progress';
import type { GetWardrobe } from '@application/use-cases/get-wardrobe';
import type { GetWorldMap } from '@application/use-cases/get-world-map';
import type { StartMission } from '@application/use-cases/start-mission';
import type { SuggestNextGoal } from '@application/use-cases/suggest-next-goal';
import type { ToggleWardrobeItem } from '@application/use-cases/toggle-wardrobe-item';

/**
 * Everything the user interface is allowed to do. The presentation layer
 * depends on this contract only; the composition root (src/main) builds it.
 */
export interface GameServices {
  readonly getPlayerProgress: GetPlayerProgress;
  readonly getWorldMap: GetWorldMap;
  readonly startMission: StartMission;
  readonly chooseMissionAnswer: ChooseMissionAnswer;
  readonly getWardrobe: GetWardrobe;
  readonly buyWardrobeItem: BuyWardrobeItem;
  readonly toggleWardrobeItem: ToggleWardrobeItem;
  readonly suggestNextGoal: SuggestNextGoal;
  readonly speech: Speech;
}
