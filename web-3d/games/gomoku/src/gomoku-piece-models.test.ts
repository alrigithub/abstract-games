import { describe, expect, it } from 'vitest';
import { GOMOKU_DIMS, GOMOKU_GLB_DIAMETER_M, GOMOKU_GLB_WORLD_SCALE } from '@abstract/three-engine';

describe('Gomoku GLB scale', () => {
  it('maps 22 mm stones to STONE_R footprint', () => {
    expect(GOMOKU_GLB_WORLD_SCALE * (GOMOKU_GLB_DIAMETER_M / 2)).toBeCloseTo(GOMOKU_DIMS.STONE_R, 5);
  });
});
