// Prints what a child downloads, against the goals in docs/plano-vida-real.md. Run after a build.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const INITIAL_JS_GOAL = 300 * KB;

const assets = join('dist', 'assets');
const html = await readFile(join('dist', 'index.html'), 'utf8');
const initial = new Set([...html.matchAll(/assets\/([^"]+\.js)/g)].map((match) => match[1]));

const scripts = (await readdir(assets)).filter((name) => name.endsWith('.js'));
const rows = await Promise.all(
  scripts.map(async (name) => ({
    name,
    size: gzipSync(await readFile(join(assets, name))).length,
    first: initial.has(name),
  })),
);
rows.sort((a, b) => b.size - a.size);
for (const { name, size, first } of rows) {
  console.log(
    `${first ? 'inicial ' : 'depois  '} ${(size / KB).toFixed(0).padStart(5)} kB  ${name}`,
  );
}

const firstLoad = rows.filter((row) => row.first).reduce((sum, row) => sum + row.size, 0);
console.log(`\nJS inicial: ${(firstLoad / KB).toFixed(0)} kB (meta: ${INITIAL_JS_GOAL / KB} kB)`);

const models = join('dist', 'models', 'world');
const sizes = await Promise.all(
  (await readdir(models)).map(async (name) => (await stat(join(models, name))).size),
);
const total = sizes.reduce((sum, size) => sum + size, 0);
console.log(`Modelos do mundo: ${(total / KB).toFixed(0)} kB em ${sizes.length} arquivos`);
if (firstLoad > INITIAL_JS_GOAL) process.exitCode = 1;
