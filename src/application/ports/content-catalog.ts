import type { WardrobeItem, WardrobeItemId } from '@domain/avatar/wardrobe-item';
import type { Mission, MissionId } from '@domain/mission/mission';
import type { World } from '@domain/world/world';

/** Read-only game content: worlds, missions and wardrobe items. */
export interface ContentCatalog {
  listWorlds(): Promise<readonly World[]>;
  findMission(id: MissionId): Promise<Mission | undefined>;
  listWardrobeItems(): Promise<readonly WardrobeItem[]>;
  findWardrobeItem(id: WardrobeItemId): Promise<WardrobeItem | undefined>;
}
