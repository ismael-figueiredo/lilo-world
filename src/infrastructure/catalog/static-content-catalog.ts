import type { ContentCatalog } from '@application/ports/content-catalog';
import type { WardrobeItem, WardrobeItemId } from '@domain/avatar/wardrobe-item';
import type { Mission, MissionId } from '@domain/mission/mission';
import type { World } from '@domain/world/world';
import * as defaultContent from '@infrastructure/catalog/content';

export interface GameContent {
  readonly worlds: readonly World[];
  readonly missions: readonly Mission[];
  readonly wardrobeItems: readonly WardrobeItem[];
}

/** Content bundled with the game. A remote or therapist-edited catalog can replace it later. */
export class StaticContentCatalog implements ContentCatalog {
  constructor(private readonly content: GameContent = defaultContent) {}

  listWorlds(): Promise<readonly World[]> {
    return Promise.resolve(this.content.worlds);
  }

  findMission(id: MissionId): Promise<Mission | undefined> {
    return Promise.resolve(this.content.missions.find((mission) => mission.id === id));
  }

  listWardrobeItems(): Promise<readonly WardrobeItem[]> {
    return Promise.resolve(this.content.wardrobeItems);
  }

  findWardrobeItem(id: WardrobeItemId): Promise<WardrobeItem | undefined> {
    return Promise.resolve(this.content.wardrobeItems.find((item) => item.id === id));
  }
}
