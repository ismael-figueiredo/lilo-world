import type { AvatarDefinition, AvatarId } from '@domain/avatar/avatar';
import type { WardrobeItem, WardrobeItemId } from '@domain/avatar/wardrobe-item';
import type { SkillDefinition } from '@domain/curriculum/skill';
import type { Word } from '@domain/language/word';
import type { Mission, MissionId } from '@domain/mission/mission';
import type { World } from '@domain/world/world';

/** Read-only game content: worlds, missions, avatars and wardrobe items. */
export interface ContentCatalog {
  listWorlds(): Promise<readonly World[]>;
  findMission(id: MissionId): Promise<Mission | undefined>;
  listWardrobeItems(): Promise<readonly WardrobeItem[]>;
  findWardrobeItem(id: WardrobeItemId): Promise<WardrobeItem | undefined>;
  listAvatars(): Promise<readonly AvatarDefinition[]>;
  findAvatar(id: AvatarId): Promise<AvatarDefinition | undefined>;
  /** Words with pictures for the Portuguese activities. */
  listWords(): Promise<readonly Word[]>;
  /** The curriculum: everything the child can learn, in order. */
  listSkills(): Promise<readonly SkillDefinition[]>;
}
