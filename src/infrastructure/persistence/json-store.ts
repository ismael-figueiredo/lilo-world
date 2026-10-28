/**
 * Safe access to Web Storage. Storage can be missing, blocked (private mode)
 * or full, so reads fall back to undefined and writes never throw.
 */
export class JsonStore {
  constructor(private readonly storage: Storage | undefined) {}

  read(key: string): unknown {
    try {
      const raw = this.storage?.getItem(key);
      return raw === null || raw === undefined ? undefined : (JSON.parse(raw) as unknown);
    } catch {
      return undefined;
    }
  }

  write(key: string, value: unknown): void {
    try {
      this.storage?.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Could not save', key, error);
    }
  }

  remove(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {
      // Nothing else to do.
    }
  }

  /** Every stored key that starts with `prefix`. */
  keysWithPrefix(prefix: string): string[] {
    const keys: string[] = [];
    try {
      const storage = this.storage;
      if (storage === undefined) return keys;
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key?.startsWith(prefix) === true) keys.push(key);
      }
    } catch {
      // Ignore: treated as empty.
    }
    return keys;
  }
}
