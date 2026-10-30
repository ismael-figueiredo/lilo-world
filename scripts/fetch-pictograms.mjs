// Downloads the ARASAAC pictograms listed in src/infrastructure/catalog/pictograms.json
// and writes small WebP files to public/pictograms. License and credit: CREDITS.md.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('..', import.meta.url);
const outDir = new URL('public/pictograms/', root);
const SIZE = 256;

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- plain JSON map
const list = /** @type {Record<string, unknown>} */ (
  JSON.parse(await readFile(new URL('src/infrastructure/catalog/pictograms.json', root), 'utf8'))
);
const ids = [...new Set(Object.values(list).filter((id) => typeof id === 'number'))];

await mkdir(outDir, { recursive: true });
for (const id of ids) {
  const out = new URL(`${id}.webp`, outDir);
  const done = await access(out).then(
    () => true,
    () => false,
  );
  if (done) continue;
  const response = await fetch(`https://static.arasaac.org/pictograms/${id}/${id}_500.png`);
  if (!response.ok) throw new Error(`Download failed for ${id}: ${response.status}`);
  const image = Buffer.from(await response.arrayBuffer());
  await writeFile(out, await sharp(image).resize(SIZE, SIZE).webp({ quality: 80 }).toBuffer());
}
console.log(`${ids.length} pictograms in public/pictograms`);
