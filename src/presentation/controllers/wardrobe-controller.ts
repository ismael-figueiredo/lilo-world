import { phrases } from '@application/phrases';
import * as THREE from 'three';
import type { WardrobeEntry } from '@application/use-cases/get-wardrobe';
import type { AvatarDefinition } from '@domain/avatar/avatar';
import { outfits, type OutfitId } from '@domain/avatar/child';
import type { GameContext } from '@presentation/game-context';
import { WardrobePanel, type WardrobeView } from '@presentation/ui/wardrobe-panel';

/** Close-up of the character while the child picks a character, colors and accessories. */
export class WardrobeController {
  readonly panel: WardrobePanel;
  private busy = false;

  constructor(private readonly ctx: GameContext) {
    this.panel = new WardrobePanel({
      onSelect: (entry) => void this.select(entry),
      onSelectAvatar: (avatar) => void this.selectAvatar(avatar),
      onSelectOutfit: (outfit) => void this.selectOutfit(outfit),
      onEditChild: () => {
        this.editChild();
      },
      onClose: () => {
        this.panel.close();
        this.ctx.backToExploring();
      },
    });
  }

  async open(): Promise<void> {
    this.ctx.enterPanel('wardrobe');
    this.panel.open(await this.view());
    this.frameCharacter();
    this.ctx.avatar.playEmote('Wave');
    this.ctx.say(phrases.wardrobeOpen);
  }

  close(): void {
    this.panel.close();
  }

  private async view(): Promise<WardrobeView> {
    const [wardrobe, avatars] = await Promise.all([
      this.ctx.player.getWardrobe.execute(),
      this.ctx.services.listAvatars.execute(),
    ]);
    return {
      wardrobe,
      avatars,
      avatarId: this.ctx.profile.avatarId,
      outfit: this.ctx.profile.outfit,
      pictureOf: (id) => this.ctx.avatarPicture(id),
      outfitPicture: (id) => this.ctx.outfitPicture(id),
    };
  }

  private frameCharacter(): void {
    const { x, y, z } = this.ctx.avatar.position;
    const cameraPosition = new THREE.Vector3(x - 0.6, y + 1.6, z - 4);
    this.ctx.avatar.faceTowards(cameraPosition);
    this.ctx.rig.setFocus(cameraPosition, new THREE.Vector3(x - 1.2, y + 1, z));
  }

  private async selectAvatar(avatar: AvatarDefinition): Promise<void> {
    if (this.busy || avatar.id === this.ctx.profile.avatarId) return;
    this.busy = true;
    try {
      await this.ctx.changeAvatar(avatar.id);
      this.frameCharacter();
      this.ctx.avatar.playEmote('Wave');
      this.ctx.sound('correct');
      this.ctx.say(phrases.avatarChanged(avatar.name));
      this.panel.show(await this.view());
    } finally {
      this.busy = false;
    }
  }

  private async selectOutfit(outfit: OutfitId): Promise<void> {
    if (this.busy || outfit === this.ctx.profile.outfit) return;
    this.busy = true;
    try {
      await this.ctx.changeOutfit(outfit);
      this.ctx.avatar.playEmote('Yes');
      this.ctx.sound('correct');
      const name = outfits.find((o) => o.id === outfit)?.name ?? '';
      this.ctx.say(phrases.outfitWorn(name));
      this.panel.show(await this.view());
    } finally {
      this.busy = false;
    }
  }

  private editChild(): void {
    this.ctx.editChild(() => {
      void this.afterEdit();
    });
  }

  private async afterEdit(): Promise<void> {
    this.frameCharacter();
    this.ctx.avatar.playEmote('Wave');
    this.panel.show(await this.view());
  }

  private async select(entry: WardrobeEntry): Promise<void> {
    if (!entry.owned && !entry.affordable) {
      const { coins } = await this.ctx.player.getWardrobe.execute();
      this.ctx.say(phrases.coinsMissing(entry.item.price - coins));
      return;
    }

    const result = entry.owned
      ? await this.ctx.player.toggleWardrobeItem.execute(entry.item.id)
      : await this.ctx.player.buyWardrobeItem.execute(entry.item.id);
    if (!result.ok) return;

    if (!entry.owned) this.ctx.sound('coin');
    await this.ctx.refresh();
    this.panel.show(await this.view());
    this.ctx.avatar.playEmote(entry.owned ? 'Yes' : 'ThumbsUp');
    this.ctx.say(entry.owned ? entry.item.name : phrases.itemWorn(entry.item.name));
  }
}
