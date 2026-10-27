import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BOOP_VASE_GLB, boopVaseGlbFor } from './boop-vase-assets';

const piecesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../lib/pieces');

describe('boop vase assets', () => {
  it('maps each player and size to its baked low-poly vase GLB', () => {
    expect(boopVaseGlbFor('A', 'kitten')).toBe('boop-vase-small-white-baked.glb');
    expect(boopVaseGlbFor('A', 'cat')).toBe('boop-vase-large-white-baked.glb');
    expect(boopVaseGlbFor('B', 'kitten')).toBe('boop-vase-small-black-baked.glb');
    expect(boopVaseGlbFor('B', 'cat')).toBe('boop-vase-large-black-baked.glb');
  });

  it('ships each mapped vase GLB in the shared piece library', () => {
    for (const file of Object.values(BOOP_VASE_GLB.A).concat(Object.values(BOOP_VASE_GLB.B))) {
      const full = path.join(piecesDir, file);
      expect(fs.existsSync(full), `${file} missing`).toBe(true);
      expect(fs.statSync(full).size, `${file} empty`).toBeGreaterThan(0);
    }
  });

  it.each(Object.values(BOOP_VASE_GLB.A).concat(Object.values(BOOP_VASE_GLB.B)))(
    '%s keeps the baked geometry and texture budget',
    file => {
      const bytes = fs.readFileSync(path.join(piecesDir, file));
      expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
      const jsonLength = bytes.readUInt32LE(12);
      const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as {
        extensionsUsed: string[];
        meshes: { primitives: { mode?: number; indices?: number; attributes: { POSITION: number } }[] }[];
        accessors: { count: number }[];
        materials: { extensions?: { KHR_materials_unlit?: object } }[];
        textures: { source: number }[];
        images: { mimeType: string; bufferView: number }[];
        bufferViews: { byteOffset?: number; byteLength: number }[];
      };
      expect(gltf.extensionsUsed).toContain('KHR_materials_unlit');
      expect(gltf.materials.length).toBeGreaterThan(0);
      for (const material of gltf.materials) {
        expect(material.extensions?.KHR_materials_unlit).toBeDefined();
      }
      let triangles = 0;
      for (const mesh of gltf.meshes) {
        for (const primitive of mesh.primitives) {
          expect(primitive.mode ?? 4).toBe(4);
          triangles += gltf.accessors[primitive.indices ?? primitive.attributes.POSITION]!.count / 3;
        }
      }
      expect(triangles).toBeGreaterThan(0);
      expect(triangles).toBeLessThanOrEqual(2200);
      expect(gltf.textures).toHaveLength(1);
      expect(gltf.images).toHaveLength(1);
      expect(gltf.textures[0]!.source).toBe(0);
      const image = gltf.images[0]!;
      expect(image.mimeType).toBe('image/png');
      const view = gltf.bufferViews[image.bufferView]!;
      const start = 28 + jsonLength + (view.byteOffset ?? 0);
      const png = bytes.subarray(start, start + view.byteLength);
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      for (const dimension of [png.readUInt32BE(16), png.readUInt32BE(20)]) {
        expect(dimension).toBeGreaterThan(0);
        expect(dimension).toBeLessThanOrEqual(512);
      }
    },
  );
});
