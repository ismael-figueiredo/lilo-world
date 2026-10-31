import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { avatarModelUrl, rigFor } from '@presentation/actors/avatar-rigs';
import { Figure, figureClips } from '@presentation/actors/child-figure';
import type { PersonLook } from '@presentation/actors/cast';
import { Player } from '@presentation/actors/player';

/** Loads costume models once and builds fresh characters from them. */
export class AvatarLibrary {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<GLTF>>();

  constructor(private readonly baseUrl: string) {}

  /** The child, a grown-up or a neighbor: made of parts, nothing to download. */
  createPerson({ look, clothes, build }: PersonLook): Player {
    const figure = new Figure(look, build);
    figure.wear(clothes);
    return new Player(figure.model, figureClips(build), build, rigFor(build), figure);
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
