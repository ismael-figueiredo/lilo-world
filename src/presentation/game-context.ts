import type { DayState } from '@domain/day/day-plan';
import type { Weather } from '@domain/day/weather';
import type { HomeController } from '@presentation/controllers/home-controller';
import type { WardrobeController } from '@presentation/controllers/wardrobe-controller';
import type { Town } from '@presentation/world/town';
import type { OutfitId } from '@domain/avatar/child';
import type { CastMember } from '@presentation/actors/cast';
import type { GameServices, PlayerServices } from '@application/game-services';
import type { SoundEffect } from '@application/ports/audio';
import type { PlayerProfile } from '@domain/profile/player-profile';
import type { Settings } from '@domain/settings/settings';
import type { Player } from '@presentation/actors/player';
import type { CameraRig } from '@presentation/engine/camera-rig';
import type { Station } from '@domain/curriculum/skill';
import type { ErrandController } from '@presentation/controllers/errand-controller';
import type { SchoolController } from '@presentation/controllers/school-controller';
import type { WalkableSpace } from '@presentation/world/game-world';
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
  | 'pause'
  | 'home'
  | 'rest';

export type PanelMode =
  'mission' | 'learning' | 'session' | 'wardrobe' | 'menu' | 'pause' | 'home' | 'rest';

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
  readonly errand: ErrandController;
  /** The adult at home, when there is one. */
  readonly guardian: Player | undefined;
  guardianStandsAt(where: 'kitchen' | 'fridge' | 'stove' | 'table'): void;
  readonly school: SchoolController;
  /** Into a place of its own, at its entrance. */
  enterSpace(space: WalkableSpace): void;
  /** Back on the island, at the door of a place. */
  leaveSpace(doorId: string): void;
  /** Someone who stays where they are put, and answers a greeting. */
  addClassmate(member: CastMember): Player;
  /** During a scene that takes a while: the camera stays in the child's hands. */
  letLookAround(): void;
  /** The goal changed: arrows and the map show the new one. */
  refreshGoal(): void;
  /** Free study of a subject, at the desk. */
  practice(subject: Station, onLeave: () => void): Promise<void>;
  /** Life inside the house. */
  readonly home: HomeController;
  readonly wardrobe: WardrobeController;
  /** The town, for those who only happen outside. */
  readonly town: Town;
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
  /** Saves the clothes of the child and changes them on the same body. */
  changeOutfit(outfit: OutfitId): Promise<void>;
  /** Opens the child creator; `changed` runs after the new look is saved. */
  editChild(changed: () => void): void;
  avatarPicture(avatarId: string): string;
  outfitPicture(outfit: OutfitId): string;
  /** The day moved on: the sky, the weather and the sounds follow it. */
  showDay(day: DayState): void;
  /** Today's weather for this child. */
  readonly weather: Weather;
  /** A block of the day ended: saves and lets a due rest come now, between things. */
  stopPoint(): Promise<void>;
  /** Waits until a calm pause is over. */
  whileNotPaused(): Promise<void>;
  /** Goes through the street door, downloading the town if needed. */
  goOutside(): Promise<void>;
  /** Back from the street into the house. */
  goInside(): Promise<void>;
  /** Runs `change` behind a short fade, e.g. to step into a building. */
  transition(change: () => void): Promise<void>;
  /** Shows the loading screen while something takes longer than a blink. */
  whileLoading<T>(work: Promise<T>): Promise<T>;
  /** Adds someone of the town to the scene, e.g. the market's cashier. */
  addPerson(member: CastMember): Player;
}
