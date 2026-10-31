import { phrases } from '@application/phrases';
import type { Settings } from '@domain/settings/settings';
import type { GameContext } from '@presentation/game-context';
import { MapPanel } from '@presentation/ui/map-panel';
import { MenuPanel, type MenuChoice } from '@presentation/ui/menu-panel';
import { ProgressPanel } from '@presentation/ui/progress-panel';
import { SettingsPanel } from '@presentation/ui/settings-panel';
import type { Interactable } from '@presentation/world/interactable';

/** Pause menu and its screens: map, progress, settings, switch player. */
export class MenuController {
  readonly menu: MenuPanel;
  readonly settingsPanel: SettingsPanel;
  readonly map: MapPanel;
  readonly progress: ProgressPanel;

  constructor(
    private readonly ctx: GameContext,
    private readonly goalId: () => string | undefined,
  ) {
    const back = () => {
      this.closeAll();
      this.ctx.sound('close');
      this.ctx.backToExploring();
    };
    this.menu = new MenuPanel((choice) => void this.choose(choice));
    this.settingsPanel = new SettingsPanel({
      onChange: (patch, preview) => void this.changeSettings(patch, preview),
      onClose: back,
      loadSkills: () => this.ctx.player.planSession.overview(),
    });
    this.map = new MapPanel({
      onSelect: (place) => {
        this.goTo(place);
      },
      onClose: back,
    });
    this.progress = new ProgressPanel(back);
  }

  get elements(): HTMLElement[] {
    return [this.menu.element, this.settingsPanel.element, this.map.element, this.progress.element];
  }

  open(): void {
    this.ctx.enterPanel('menu');
    this.ctx.sound('open');
    this.menu.open(this.ctx.profile.name);
  }

  openMap(): void {
    this.ctx.enterPanel('menu');
    this.ctx.sound('open');
    this.showMap();
  }

  closeAll(): void {
    this.menu.close();
    this.settingsPanel.close();
    this.map.close();
    this.progress.close();
  }

  private async choose(choice: MenuChoice): Promise<void> {
    this.menu.close();
    switch (choice) {
      case 'continue':
        this.ctx.sound('close');
        this.ctx.backToExploring();
        return;
      case 'today':
        this.ctx.home.openAgenda();
        return;
      case 'map':
        this.showMap();
        return;
      case 'progress':
        this.progress.open(
          this.ctx.profile.name,
          await this.ctx.player.getProgressSummary.execute(),
          await this.ctx.player.getAlbum.execute(),
        );
        return;
      case 'settings':
        this.settingsPanel.open(this.ctx.settings);
        return;
      case 'switch-player':
        await this.ctx.switchPlayer();
        return;
    }
  }

  private showMap(): void {
    if (this.ctx.world.indoors) {
      this.ctx.backToExploring(phrases.mapOutside);
      return;
    }
    const { position, facing } = this.ctx.avatar;
    this.map.open(
      this.ctx.world.townPlaces,
      { x: position.x, z: position.z, facing },
      this.goalId(),
    );
  }

  private goTo(place: Interactable): void {
    this.closeAll();
    this.ctx.setDestination(place);
    this.ctx.backToExploring();
    this.ctx.say(phrases.goToPlace(place.name));
  }

  private async changeSettings(
    patch: Partial<Settings>,
    preview?: 'effects' | 'voice' | 'music',
  ): Promise<void> {
    const settings = await this.ctx.player.updateSettings.execute(patch);
    this.ctx.applySettings(settings);
    this.settingsPanel.render(settings);
    if (preview === 'effects') this.ctx.sound('coin');
    if (preview === 'voice') this.ctx.say(phrases.voicePreview);
  }
}
