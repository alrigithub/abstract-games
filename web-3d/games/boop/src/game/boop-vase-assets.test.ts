import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BOOP_VASE_GLB, boopVaseGlbFor } from './boop-vase-assets';

const piecesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../lib/pieces');

describe('boop vase assets', () => {
  it('maps each player and size to the Alex stone vase GLB filename', () => {
    expect(boopVaseGlbFor('A', 'kitten')).toBe('boop-vase-small-white.glb');
    expect(boopVaseGlbFor('A', 'cat')).toBe('boop-vase-large-white.glb');
    expect(boopVaseGlbFor('B', 'kitten')).toBe('boop-vase-small-black.glb');
    expect(boopVaseGlbFor('B', 'cat')).toBe('boop-vase-large-black.glb');
  });

  it('ships each mapped vase GLB in the shared piece library', () => {
    for (const file of Object.values(BOOP_VASE_GLB.A).concat(Object.values(BOOP_VASE_GLB.B))) {
      const full = path.join(piecesDir, file);
      expect(fs.existsSync(full), `${file} missing`).toBe(true);
      expect(fs.statSync(full).size, `${file} empty`).toBeGreaterThan(0);
    }
  });
});
