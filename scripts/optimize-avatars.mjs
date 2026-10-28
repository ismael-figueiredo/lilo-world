// Downloads the avatar models listed in scripts/avatars.json, removes props
// (weapons), keeps only the animations the game uses (renamed to standard
// names), and writes small GLB files to public/models/avatars.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize } from '@gltf-transform/functions';

const root = new URL('..', import.meta.url);
const cacheDir = new URL('assets-src/avatars/', root);
const outDir = new URL('public/models/avatars/', root);
/**
 * @typedef {object} AvatarSource
 * @property {string} id
 * @property {string} source
 * @property {string[]} hide
 * @property {Record<string, string>} animations
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON shape documented above
const manifest = /** @type {{ avatars: AvatarSource[] }} */ (
  JSON.parse(await readFile(new URL('scripts/avatars.json', root), 'utf8'))
);

await mkdir(cacheDir, { recursive: true });
await mkdir(outDir, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** @param {URL} url */
const exists = (url) =>
  access(url).then(
    () => true,
    () => false,
  );

for (const avatar of manifest.avatars) {
  const cached = new URL(`${avatar.id}.source.glb`, cacheDir);
  if (!(await exists(cached))) {
    const response = await fetch(avatar.source);
    if (!response.ok) throw new Error(`Download failed for ${avatar.id}: ${response.status}`);
    await writeFile(cached, Buffer.from(await response.arrayBuffer()));
  }
  const document = await io.read(cached.pathname);
  const docRoot = document.getRoot();

  for (const node of docRoot.listNodes()) {
    const meshName = node.getMesh()?.getName();
    if (avatar.hide.includes(node.getName()) || (meshName && avatar.hide.includes(meshName))) {
      node.dispose();
    }
  }

  const wanted = Object.entries(avatar.animations);
  const taken = new Set();
  for (const animation of docRoot.listAnimations()) {
    const shortName = animation.getName().split('|').pop();
    const match = wanted.find(([key, source]) => source === shortName && !taken.has(key));
    if (match === undefined) {
      animation.dispose();
      continue;
    }
    taken.add(match[0]);
    animation.setName(match[0]);
  }
  const missing = wanted.map(([key]) => key).filter((key) => !taken.has(key));
  if (missing.length > 0)
    throw new Error(`${avatar.id} is missing animations: ${missing.join(', ')}`);

  await document.transform(prune(), dedup(), quantize());
  const out = new URL(`${avatar.id}.glb`, outDir);
  await io.write(out.pathname, document);
  const size = (await readFile(out)).byteLength;
  console.log(
    `${avatar.id.padEnd(16)} ${(size / 1024).toFixed(0).padStart(5)} KB  ${[...taken].join(', ')}`,
  );
}
