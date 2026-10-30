import type { ContentCatalog } from '@application/ports/content-catalog';
import type { AvatarDefinition, AvatarId } from '@domain/avatar/avatar';
import type { WardrobeItem, WardrobeItemId } from '@domain/avatar/wardrobe-item';
import type { Word } from '@domain/learning/challenge';
import type { Mission, MissionId } from '@domain/mission/mission';
import type { World } from '@domain/world/world';
import { avatars, missions, wardrobeItems, worlds } from '@infrastructure/catalog/content';
import pictograms from '@infrastructure/catalog/pictograms.json';
import { words } from '@infrastructure/catalog/words';

export interface GameContent {
  readonly worlds: readonly World[];
  readonly missions: readonly Mission[];
  readonly wardrobeItems: readonly WardrobeItem[];
  readonly avatars: readonly AvatarDefinition[];
  readonly words: readonly Word[];
}

const pictogramIds: Readonly<Record<string, unknown>> = pictograms;

/** Puts the ARASAAC pictogram on every card that has one. */
export function withPictograms(mission: Mission): Mission {
  const choices = mission.choices.map((choice) => {
    const id = pictogramIds[choice.label];
    return typeof id === 'number' ? { ...choice, image: `pictograms/${id}.webp` } : choice;
  });
  return { ...mission, choices };
}

const defaultContent: GameContent = {
  worlds,
  missions: missions.map(withPictograms),
  wardrobeItems,
  avatars,
  words,
};

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

  listAvatars(): Promise<readonly AvatarDefinition[]> {
    return Promise.resolve(this.content.avatars);
  }

  findAvatar(id: AvatarId): Promise<AvatarDefinition | undefined> {
    return Promise.resolve(this.content.avatars.find((avatar) => avatar.id === id));
  }

  listWords(): Promise<readonly Word[]> {
    return Promise.resolve(this.content.words);
  }
}
