// Downloads the world models listed in scripts/world-assets.json (buildings,
// vehicles, nature and street props), puts each one standing on the origin,
// merges meshes that share a material, shrinks textures and writes small GLB
// files (meshopt-compressed) to public/models/world.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  center,
  dedup,
  flatten,
  join,
  meshopt,
  prune,
  simplify,
  textureCompress,
  weld,
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const root = new URL('..', import.meta.url);
const cacheDir = new URL('assets-src/world/', root);
const outDir = new URL('public/models/world/', root);
/** Textures are seen small on a tablet: 256 px keeps them crisp enough. */
const TEXTURE_SIZE = 256;

/**
 * @typedef {object} WorldSource
 * @property {string} id
 * @property {string} source
 * @property {number} [simplify] Fraction of triangles to keep (detailed houses only).
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON shape documented above
const manifest = /** @type {{ models: WorldSource[] }} */ (
  JSON.parse(await readFile(new URL('scripts/world-assets.json', root), 'utf8'))
);

await mkdir(cacheDir, { recursive: true });
await mkdir(outDir, { recursive: true });
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
  .setLogger(new Logger(Logger.Verbosity.WARN));

/** @param {URL} url */
const exists = (url) =>
  access(url).then(
    () => true,
    () => false,
  );

let total = 0;
for (const model of manifest.models) {
  const cached = new URL(`${model.id}.source.glb`, cacheDir);
  if (!(await exists(cached))) {
    const response = await fetch(model.source, { headers: { 'User-Agent': 'lilo-world-assets' } });
    if (!response.ok) throw new Error(`Download failed for ${model.id}: ${response.status}`);
    await writeFile(cached, Buffer.from(await response.arrayBuffer()));
  }
  const document = await io.read(cached.pathname);

  // World models stand still (animals too): animations would only add bytes,
  // and a standing animal is a plain mesh. Skins would also lose the scale
  // that compression stores on the node.
  for (const animation of document.getRoot().listAnimations()) animation.dispose();
  for (const node of document.getRoot().listNodes()) node.setSkin(null);
  for (const skin of document.getRoot().listSkins()) skin.dispose();
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      for (const semantic of primitive.listSemantics()) {
        if (semantic.startsWith('JOINTS_') || semantic.startsWith('WEIGHTS_')) {
          primitive.setAttribute(semantic, null);
        }
      }
    }
  }

  // Normal maps cost a lot of bytes and barely show on flat-shaded toys.
  for (const material of document.getRoot().listMaterials()) material.setNormalTexture(null);

  if (model.simplify !== undefined) {
    // Faceted normals split every corner, so nothing could be merged. The game
    // draws these models flat-shaded, which needs no normals at all.
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) primitive.setAttribute('NORMAL', null);
    }
  }

  await document.transform(
    center({ pivot: 'below' }),
    flatten(),
    join(),
    weld(),
    ...(model.simplify === undefined
      ? []
      : [simplify({ simplifier: MeshoptSimplifier, ratio: model.simplify, error: 0.002 })]),
    prune(),
    dedup(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [TEXTURE_SIZE, TEXTURE_SIZE],
    }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const out = new URL(`${model.id}.glb`, outDir);
  await io.write(out.pathname, document);
  const size = (await readFile(out)).byteLength;
  total += size;
  console.log(`${model.id.padEnd(16)} ${(size / 1024).toFixed(0).padStart(5)} KB`);
}
console.log(`${'total'.padEnd(16)} ${(total / 1024).toFixed(0).padStart(5)} KB`);
