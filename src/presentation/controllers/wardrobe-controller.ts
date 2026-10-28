import * as THREE from 'three';
import type { WardrobeEntry } from '@application/use-cases/get-wardrobe';
import type { AvatarDefinition } from '@domain/avatar/avatar';
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
    this.ctx.say('Escolha um personagem e uma roupa!');
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
      pictureOf: (id) => this.ctx.avatarPicture(id),
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
      this.ctx.say(`Oi! Agora você é: ${avatar.name}!`);
      this.panel.show(await this.view());
    } finally {
      this.busy = false;
    }
  }

  private async select(entry: WardrobeEntry): Promise<void> {
    if (!entry.owned && !entry.affordable) {
      const { coins } = await this.ctx.player.getWardrobe.execute();
      this.ctx.say(`Faltam ${entry.item.price - coins} moedas. Vamos ao mercado ganhar mais?`);
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
    this.ctx.say(entry.owned ? entry.item.name : `${entry.item.name}! Ficou ótimo!`);
  }
}
