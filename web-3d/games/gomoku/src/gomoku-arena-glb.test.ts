import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BOARD, GOMOKU_DIMS, createMeshoptGltfLoader, ensureMeshoptDecoderReady, gomokuCellWorld } from '@abstract/three-engine';
import {
  GOMOKU_ARENA_GLB_SHA256,
  GOMOKU_ARENA_WORLD_SCALE,
} from './gomoku-arena';
import { createHash } from 'node:crypto';

const glbPath = join(dirname(fileURLToPath(import.meta.url)), '../public/models/ari-arena-visible-sage.glb');

function patchGltfUrlForNode(): void {
  if (typeof (globalThis as { self?: unknown }).self === 'undefined') {
    Object.defineProperty(globalThis, 'self', { value: globalThis, configurable: true });
  }
  const NativeURL = globalThis.URL;
  class PatchedURL extends NativeURL {
    static createObjectURL() {
      return 'data:application/octet-stream,';
    }
    static revokeObjectURL() {}
  }
  globalThis.URL = PatchedURL as typeof NativeURL;
}

async function loadArenaRoot(): Promise<THREE.Group> {
  patchGltfUrlForNode();
  await ensureMeshoptDecoderReady();
  const buf = readFileSync(glbPath);
  const loader = createMeshoptGltfLoader();
  const gltf = await loader.parseAsync(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    '',
  );
  const root = gltf.scene;
  const s = GOMOKU_ARENA_WORLD_SCALE;
  root.scale.set(s, s, -s);
  root.updateMatrixWorld(true);

  const mid = Math.floor(GOMOKU_DIMS.GRID / 2);
  let centerTop = 0;
  root.traverse(node => {
    if (!node.name.startsWith('Cell')) return;
    const ud = node.userData as { row?: number; column?: number };
    if (ud.row !== mid || ud.column !== mid) return;
    const box = new THREE.Box3().setFromObject(node);
    centerTop = box.max.y;
  });
  root.position.y = BOARD.PLAYFIELD_SURFACE_Y - centerTop;
  root.updateMatrixWorld(true);
  return root;
}

describe('gomoku arena GLB asset', () => {
  it('matches pinned SHA-256', () => {
    const hash = createHash('sha256').update(readFileSync(glbPath)).digest('hex');
    expect(hash).toBe(GOMOKU_ARENA_GLB_SHA256);
  });

  it('maps 225 Cell nodes to the 15×15 placement grid within tolerance', async () => {
    const root = await loadArenaRoot();
    let count = 0;
    let maxErr = 0;
    root.traverse(node => {
      if (!node.name.startsWith('Cell')) return;
      const ud = node.userData as { row?: number; column?: number };
      if (typeof ud.row !== 'number' || typeof ud.column !== 'number') return;
      count += 1;
      const box = new THREE.Box3().setFromObject(node);
      const x = (box.min.x + box.max.x) * 0.5;
      const z = (box.min.z + box.max.z) * 0.5;
      const target = gomokuCellWorld(GOMOKU_DIMS.GRID, ud.row, ud.column);
      maxErr = Math.max(maxErr, Math.hypot(x - target.x, z - target.z));
    });
    expect(count).toBe(GOMOKU_DIMS.GRID * GOMOKU_DIMS.GRID);
    expect(maxErr).toBeLessThan(0.02);
  });
});
