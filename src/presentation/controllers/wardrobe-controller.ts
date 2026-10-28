import * as THREE from 'three';
import type { WardrobeEntry } from '@application/use-cases/get-wardrobe';
import type { GameContext } from '@presentation/game-context';
import { WardrobePanel } from '@presentation/ui/wardrobe-panel';

/** Close-up of the character while the child picks colors, hats and accessories. */
export class WardrobeController {
  readonly panel: WardrobePanel;

  constructor(private readonly ctx: GameContext) {
    this.panel = new WardrobePanel({
      onSelect: (entry) => void this.select(entry),
      onClose: () => {
        this.panel.close();
        this.ctx.backToExploring();
      },
    });
  }

  async open(): Promise<void> {
    this.ctx.enterPanel('wardrobe');
    this.panel.open(await this.ctx.player.getWardrobe.execute());

    const { x, y, z } = this.ctx.avatar.position;
    const cameraPosition = new THREE.Vector3(x - 0.6, y + 1.7, z - 4.2);
    this.ctx.avatar.faceTowards(cameraPosition);
    this.ctx.rig.setFocus(cameraPosition, new THREE.Vector3(x - 1.3, y + 1.1, z));
    this.ctx.avatar.playEmote('Wave');
    this.ctx.say('Escolha uma roupa!');
  }

  close(): void {
    this.panel.close();
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
    this.panel.show(await this.ctx.player.getWardrobe.execute());
    this.ctx.avatar.playEmote(entry.owned ? 'Yes' : 'ThumbsUp');
    this.ctx.say(entry.owned ? entry.item.name : `${entry.item.name}! Ficou ótimo!`);
  }
}
