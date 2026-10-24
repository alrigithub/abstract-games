#!/usr/bin/env node
/**
 * Recompress every committed game GLB under games (public assets) with gltf-transform:
 * meshopt geometry, WebP textures (max 2048px — 1024px sources are unchanged).
 * Preserves node hierarchy, mesh bounds, and material factors (no simplify/join/flatten).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB3D = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.join(WEB3D, 'games');
const GLTF_TRANSFORM = path.join(WEB3D, 'node_modules', '.bin', 'gltf-transform');

/** @param {string} dir */
function findGlbs(dir) {
  /** @type {string[]} */
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...findGlbs(p));
    else if (ent.name.endsWith('.glb')) out.push(p);
  }
  return out.sort();
}

const OPTIMIZE_ARGS = [
  '--compress',
  'meshopt',
  '--texture-compress',
  'webp',
  '--texture-size',
  '2048',
  '--simplify',
  'false',
  '--join',
  'false',
  '--flatten',
  'false',
  '--instance',
  'false',
  '--palette',
  'false',
];

if (!fs.existsSync(GLTF_TRANSFORM)) {
  console.error('Missing gltf-transform CLI. Run: npm ci (in web-3d)');
  process.exit(1);
}

const glbs = findGlbs(GAMES);
if (glbs.length === 0) {
  console.error('No .glb files under', GAMES);
  process.exit(1);
}

let before = 0;
let after = 0;

for (const glb of glbs) {
  const sizeBefore = fs.statSync(glb).size;
  before += sizeBefore;
  const tmp = `${glb}.tmp.glb`;
  try {
    execFileSync(GLTF_TRANSFORM, ['optimize', glb, tmp, ...OPTIMIZE_ARGS], {
      stdio: 'inherit',
      cwd: WEB3D,
    });
    fs.renameSync(tmp, glb);
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    const sizeAfter = fs.statSync(glb).size;
    after += sizeAfter;
    const rel = path.relative(WEB3D, glb);
    console.log(`${rel}: ${(sizeBefore / 1024).toFixed(1)} KiB → ${(sizeAfter / 1024).toFixed(1)} KiB`);
  } catch (err) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    throw err;
  }
}

/** @param {string} dir */
function findGlbSidecars(dir) {
  /** @type {string[]} */
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...findGlbSidecars(p));
    else if (ent.name.endsWith('.glb.bin')) out.push(p);
  }
  return out;
}

for (const sidecar of findGlbSidecars(GAMES)) {
  fs.unlinkSync(sidecar);
  console.log(`removed orphan sidecar ${path.relative(WEB3D, sidecar)}`);
}

console.log(
  `\nTotal: ${(before / (1024 * 1024)).toFixed(2)} MiB → ${(after / (1024 * 1024)).toFixed(2)} MiB (${glbs.length} files)`,
);
