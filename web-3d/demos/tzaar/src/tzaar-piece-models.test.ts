import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  TZAAR_MODEL,
  TZAAR_STONE_LOOK,
  configureTzaarStoneMaterials,
  tzaarKindOf,
  tzaarModelRelPath,
} from './tzaar-piece-models';

const modelsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/models');

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

  it('authors black stones as PBR and white stones as unlit', () => {
    for (const kind of ['tzaar', 'tzarra', 'tott'] as const) {
      const black = readGlbJson(path.basename(tzaarModelRelPath(kind, 'B')));
      const white = readGlbJson(path.basename(tzaarModelRelPath(kind, 'A')));
      const blackMat = (black.materials as { pbrMetallicRoughness?: { roughnessFactor?: number }; extensions?: Record<string, unknown> }[])[0]!;
      const whiteMat = (white.materials as { extensions?: Record<string, unknown> })[0]!;
      expect(blackMat.extensions?.KHR_materials_unlit).toBeUndefined();
      expect(blackMat.pbrMetallicRoughness?.roughnessFactor).toBeCloseTo(0.6, 5);
      expect(whiteMat.extensions?.KHR_materials_unlit).toBeTruthy();
    }
  });
});

describe('tzaar stone colour look', () => {
  it('applies the same black PBR response to every type', () => {
    const pieces = ['tzaar', 'tzarra', 'tott'].map(name => {
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.6,
        metalness: 0,
        envMapIntensity: 1,
        specularIntensity: 0.5,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.name = name;
      return { name, mesh, mat };
    });
    const root = new THREE.Group();
    for (const piece of pieces) root.add(piece.mesh);
    configureTzaarStoneMaterials(root, 'B');
    for (const piece of pieces) {
      expect(piece.mat.color.getHex()).toBe(TZAAR_STONE_LOOK.blackColor);
      expect(piece.mat.envMapIntensity).toBe(TZAAR_STONE_LOOK.blackEnvMapIntensity);
      expect(piece.mat.roughness).toBe(TZAAR_STONE_LOOK.blackRoughness);
      expect(piece.mat.specularIntensity).toBe(TZAAR_STONE_LOOK.blackSpecularIntensity);
      expect(piece.mat.metalness).toBe(0);
    }
  });

  it('applies the same ivory tint to unlit whites', () => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    configureTzaarStoneMaterials(mesh, 'A');
    expect(mat.color.getHex()).toBe(TZAAR_STONE_LOOK.whiteColor);
  });
});
