import type { IdGenerator } from '@application/ports/id-generator';

/** Local ids only (never sent anywhere). */
export class RandomIdGenerator implements IdGenerator {
  next(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
