import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BOOP_VASE_GLB, boopVaseGlbFor } from './boop-vase-assets';

const piecesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../lib/pieces');

function imageDimensions(bytes: Buffer): [number, number] {
  if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  expect(bytes.readUInt16BE(0)).toBe(0xffd8);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('Invalid JPEG marker');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++]!;
    const length = bytes.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    }
    offset += length;
  }
  throw new Error('No JPEG dimensions');
}
describe('boop vase assets', () => {
  it('maps each player and size to its detailed PBR vase GLB', () => {
    expect(boopVaseGlbFor('A', 'kitten')).toBe('boop-vase-small-white-detail.glb');
    expect(boopVaseGlbFor('A', 'cat')).toBe('boop-vase-large-white-detail.glb');
    expect(boopVaseGlbFor('B', 'kitten')).toBe('boop-vase-small-black-detail.glb');
    expect(boopVaseGlbFor('B', 'cat')).toBe('boop-vase-large-black-detail.glb');
  });

  it('ships each mapped vase GLB in the shared piece library', () => {
    for (const file of Object.values(BOOP_VASE_GLB.A).concat(Object.values(BOOP_VASE_GLB.B))) {
      const full = path.join(piecesDir, file);
      expect(fs.existsSync(full), `${file} missing`).toBe(true);
      expect(fs.statSync(full).size, `${file} empty`).toBeGreaterThan(0);
    }
  });

  it.each(Object.values(BOOP_VASE_GLB.A).concat(Object.values(BOOP_VASE_GLB.B)))(
    '%s keeps the detailed geometry and texture budget',
    file => {
      const bytes = fs.readFileSync(path.join(piecesDir, file));
      expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
      const jsonLength = bytes.readUInt32LE(12);
      const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as {
        extensionsUsed?: string[];
        meshes: { primitives: { mode?: number; indices?: number; attributes: { POSITION: number } }[] }[];
        accessors: { count: number }[];
        materials: { extensions?: { KHR_materials_unlit?: object }; pbrMetallicRoughness: { baseColorTexture: { index: number } }; normalTexture: { index: number } }[];
        textures: { source: number }[];
        images: { mimeType: string; bufferView: number }[];
        bufferViews: { byteOffset?: number; byteLength: number }[];
      };
      expect(gltf.extensionsUsed ?? []).not.toContain('KHR_materials_unlit');
      expect(gltf.materials.length).toBeGreaterThan(0);
      for (const material of gltf.materials) {
        expect(material.extensions?.KHR_materials_unlit).toBeUndefined();
      }
      let triangles = 0;
      for (const mesh of gltf.meshes) {
        for (const primitive of mesh.primitives) {
          expect(primitive.mode ?? 4).toBe(4);
          triangles += gltf.accessors[primitive.indices ?? primitive.attributes.POSITION]!.count / 3;
        }
      }
      expect(triangles).toBeGreaterThan(2000);
      expect(triangles).toBeLessThanOrEqual(4200);
      expect(gltf.textures).toHaveLength(2);
      expect(gltf.images).toHaveLength(2);
      for (const material of gltf.materials) {
        for (const [texture, mime, budget] of [
          [material.pbrMetallicRoughness.baseColorTexture, 'image/jpeg', 1024],
          [material.normalTexture, 'image/png', 512],
        ] as const) {
          expect(texture).toBeDefined();
          const image = gltf.images[gltf.textures[texture.index]!.source]!;
          expect(image.mimeType).toBe(mime);
          const view = gltf.bufferViews[image.bufferView]!;
          const start = 28 + jsonLength + (view.byteOffset ?? 0);
          const dimensions = imageDimensions(bytes.subarray(start, start + view.byteLength));
          for (const dimension of dimensions) {
            expect(dimension).toBeGreaterThan(0);
            expect(dimension).toBeLessThanOrEqual(budget);
          }
        }
      }
    },
  );
});
