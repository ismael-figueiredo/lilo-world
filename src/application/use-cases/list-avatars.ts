import type { ContentCatalog } from '@application/ports/content-catalog';
import type { AvatarDefinition } from '@domain/avatar/avatar';

export class ListAvatars {
  constructor(private readonly catalog: ContentCatalog) {}

  execute(): Promise<readonly AvatarDefinition[]> {
    return this.catalog.listAvatars();
  }
}
