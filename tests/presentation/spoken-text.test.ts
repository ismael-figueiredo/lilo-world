import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const filesIn = (folder: string): string[] =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return filesIn(path);
    return path.endsWith('.ts') ? [path] : [];
  });

describe('what the game says', () => {
  it('comes from the phrases, so it can be recorded later', () => {
    // say('...') or say(x ? '...' : y): the words were written where they are said.
    const inline = /\bsay\((?:[^;]*?\s[?:])?\s*['`]/;
    for (const file of filesIn('src/presentation')) {
      expect(inline.test(readFileSync(file, 'utf8')), file).toBe(false);
    }
  });
});
