import type { GameServices, PlayerServices } from '@application/game-services';
import type { SoundEffect } from '@application/ports/audio';
import type { PlayerProfile } from '@domain/profile/player-profile';
import type { Settings } from '@domain/settings/settings';
import type { Player } from '@presentation/actors/player';
import type { CameraRig } from '@presentation/engine/camera-rig';
import type { SessionController } from '@presentation/controllers/session-controller';
import type { Dialog } from '@presentation/ui/dialog';
import type { GameWorld } from '@presentation/world/game-world';
import type { Interactable } from '@presentation/world/interactable';

export type Mode =
  | 'loading'
  | 'profiles'
  | 'explore'
  | 'mission'
  | 'learning'
  | 'session'
  | 'wardrobe'
  | 'menu'
  | 'rest';

export type PanelMode = 'mission' | 'learning' | 'session' | 'wardrobe' | 'menu' | 'rest';

/** What controllers can use. Implemented by GameApp; keeps controllers small and focused. */
export interface GameContext {
  readonly services: GameServices;
  /** Use cases of the child who is playing now. */
  readonly player: PlayerServices;
  readonly profile: PlayerProfile;
  readonly settings: Settings;
  readonly world: GameWorld;
  readonly avatar: Player;
  readonly rig: CameraRig;
  readonly dialog: Dialog;
  readonly mode: Mode;
  /** The time limit has passed: finish what is open, but start nothing new. */
  readonly restIsDue: boolean;
  /** The day's plan, also reachable from the menu. */
  readonly session: SessionController;
  enterPanel(mode: PanelMode): void;
  /** Back to the world. `message` is said instead of the suggestion of what to do next. */
  backToExploring(message?: string): void;
  /** Says `message` and writes it, or `written` when the two must differ. */
  say(message: string, written?: string): void;
  sound(effect: SoundEffect): void;
  /** Reloads progress and updates everything that depends on it. */
  refresh(): Promise<void>;
  applySettings(settings: Settings): void;
  /** A place chosen on the map; the golden arrow points there until it is reached. */
  setDestination(place: Interactable | undefined): void;
  switchPlayer(): Promise<void>;
  /** Swaps the 3D character and remembers the choice for this child. */
  changeAvatar(avatarId: string): Promise<void>;
  avatarPicture(avatarId: string): string;
  /** Runs `change` behind a short fade, e.g. to step into a building. */
  transition(change: () => void): Promise<void>;
  /** Adds another character to the scene, e.g. the market's cashier. */
  createCharacter(avatarId: string): Promise<Player>;
}
