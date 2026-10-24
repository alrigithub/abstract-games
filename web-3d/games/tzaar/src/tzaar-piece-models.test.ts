import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dequantize, getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  TZAAR_GLB_DIAMETER_M,
  TZAAR_GLB_HEIGHT_M,
  TZAAR_GLB_WORLD_SCALE,
  layoutStackCenters,
} from '@abstract/three-engine';
import { CLAY, applyClayPieceMaterials, getClayMaterial } from '@abstract/three-engine';
import { TZAAR_MODEL, tzaarKindOf, tzaarModelRelPath } from './tzaar-piece-models';

const modelsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/models');

let gltfIo: NodeIO;

beforeAll(async () => {
  await MeshoptDecoder.ready;
  gltfIo = new NodeIO()
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization, EXTTextureWebP]);
});

async function readMeshWorldBounds(filename: string): Promise<{
  baseY: number;
  height: number;
  diameter: number;
}> {
  const doc = await gltfIo.read(path.join(modelsDir, filename));
  await doc.transform(dequantize());
  const scene = doc.getRoot().listScenes()[0]!;
  const { min, max } = getBounds(scene);
  return {
    baseY: min[1]!,
    height: max[1]! - min[1]!,
    diameter: max[0]! - min[0]!,
  };
}

function readGlbJson(filename: string): Record<string, unknown> {
  const data = readFileSync(path.join(modelsDir, filename));
  const jsonLength = data.readUInt32LE(12);
  return JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8')) as Record<string, unknown>;
}

describe('tzaar GLB mapping', () => {
  it('maps each type to its own white and black GLB', () => {
    expect(tzaarKindOf({ id: '1', player: 'A', shape: 'tzaar' })).toBe('tzaar');
    expect(tzaarKindOf({ id: '2', player: 'B', shape: 'tzarra' })).toBe('tzarra');
    expect(tzaarKindOf({ id: '3', player: 'A', shape: 'tott' })).toBe('tott');
    expect(tzaarModelRelPath('tzaar', 'A')).toBe(TZAAR_MODEL.tzaarWhite);
    expect(tzaarModelRelPath('tzaar', 'B')).toBe(TZAAR_MODEL.tzaarBlack);
    expect(tzaarModelRelPath('tzarra', 'A')).toBe(TZAAR_MODEL.tzarraWhite);
    expect(tzaarModelRelPath('tzarra', 'B')).toBe(TZAAR_MODEL.tzarraBlack);
    expect(tzaarModelRelPath('tott', 'A')).toBe(TZAAR_MODEL.tottWhite);
    expect(tzaarModelRelPath('tott', 'B')).toBe(TZAAR_MODEL.tottBlack);
  });

  it('ships six type×colour GLBs with matching node names', () => {
    for (const kind of ['tzaar', 'tzarra', 'tott'] as const) {
      for (const side of ['A', 'B'] as const) {
        const rel = tzaarModelRelPath(kind, side);
        const filename = path.basename(rel);
        expect(existsSync(path.join(modelsDir, filename)), filename).toBe(true);
        const gltf = readGlbJson(filename);
        const nodes = gltf.nodes as { name?: string }[];
        const colour = side === 'B' ? 'black' : 'white';
        expect(nodes.some(node => node.name === `tzaar-${kind}-${colour}`)).toBe(true);
      }
    }
  });

  it('keeps one authored height and ~28 mm diameter so stacks stay flush', async () => {
    const bounds = await Promise.all(
      (['tzaar', 'tzarra', 'tott'] as const).flatMap(kind =>
        (['A', 'B'] as const).map(async side => {
          const filename = path.basename(tzaarModelRelPath(kind, side));
          const { baseY, height, diameter } = await readMeshWorldBounds(filename);
          return { filename, height, diameter, baseY };
        }),
      ),
    );
    const height = bounds[0]!.height;
    for (const piece of bounds) {
      expect(piece.baseY, piece.filename).toBeCloseTo(0, 5);
      expect(piece.height, piece.filename).toBeCloseTo(height, 5);
      expect(piece.height, piece.filename).toBeCloseTo(TZAAR_GLB_HEIGHT_M, 3);
      expect(piece.diameter, piece.filename).toBeCloseTo(TZAAR_GLB_DIAMETER_M, 2);
    }
    const worldHeight = height * TZAAR_GLB_WORLD_SCALE;
    const stack = [
      { id: 'lower', player: 'A', shape: 'tott' },
      { id: 'upper', player: 'A', shape: 'tzaar' },
    ];
    const centers = layoutStackCenters(stack, {
      heightOf: () => worldHeight,
      offsetOf: () => 0,
    });
    expect(centers[1]! - centers[0]!).toBeCloseTo(worldHeight, 8);
  });

  it('authors black stones as PBR and white stones as unlit', () => {
    for (const kind of ['tzaar', 'tzarra', 'tott'] as const) {
      const black = readGlbJson(path.basename(tzaarModelRelPath(kind, 'B')));
      const white = readGlbJson(path.basename(tzaarModelRelPath(kind, 'A')));
      const blackMats = (black.materials ?? []) as {
        pbrMetallicRoughness?: { roughnessFactor?: number };
        extensions?: Record<string, unknown>;
      }[];
      const whiteMats = (white.materials ?? []) as { extensions?: Record<string, unknown> }[];
      const blackMat = blackMats[0]!;
      const whiteMat = whiteMats[0]!;
      expect(blackMat.extensions?.KHR_materials_unlit).toBeUndefined();
      expect(blackMat.pbrMetallicRoughness?.roughnessFactor).toBeCloseTo(0.6, 5);
      expect(whiteMat.extensions?.KHR_materials_unlit).toBeTruthy();
    }
  });
});

describe('tzaar stone clay materials', () => {
  it('overrides authored GLB materials with shared clay piece colors', () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xff00ff }));
    const root = new THREE.Group();
    root.add(mesh);
    applyClayPieceMaterials(root, 'light');
    expect(mesh.material).toBe(getClayMaterial('piece_light'));
    expect(`#${(mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`).toBe(CLAY.PIECE_LIGHT);
    applyClayPieceMaterials(root, 'dark');
    expect(mesh.material).toBe(getClayMaterial('piece_dark'));
    expect(`#${(mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`).toBe(CLAY.PIECE_DARK);
  });
});
