import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { avatarModelUrl, rigFor } from '@presentation/actors/avatar-rigs';
import { Player } from '@presentation/actors/player';

/** Loads avatar models once and builds fresh characters from them. */
export class AvatarLibrary {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<GLTF>>();

  constructor(private readonly baseUrl: string) {}

  /** Starts downloading in the background (e.g. while the child picks a character). */
  preload(avatarId: string): void {
    void this.load(avatarId).catch(() => undefined);
  }

  async create(avatarId: string): Promise<Player> {
    const gltf = await this.load(avatarId);
    const model = clone(gltf.scene);
    return new Player(model, gltf.animations, avatarId, rigFor(avatarId));
  }

  private load(avatarId: string): Promise<GLTF> {
    let request = this.cache.get(avatarId);
    if (request === undefined) {
      request = this.loader.loadAsync(avatarModelUrl(this.baseUrl, avatarId));
      request.catch(() => this.cache.delete(avatarId));
      this.cache.set(avatarId, request);
    }
    return request;
  }
}
