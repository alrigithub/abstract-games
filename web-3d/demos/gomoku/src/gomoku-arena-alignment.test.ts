import { describe, expect, it } from 'vitest';
import { GOMOKU_DIMS, gomokuCellWorld } from '@abstract/three-engine';
import {
  GOMOKU_ARENA_FIELD_HALF_M,
  GOMOKU_ARENA_TILE_PITCH_M,
  GOMOKU_ARENA_WORLD_SCALE,
  gomokuArenaCellAuthoredXz,
  gomokuArenaCellWorldXz,
  gomokuArenaPlacementError,
} from './gomoku-arena';

describe('gomoku arena grid alignment', () => {
  it('uses 1.05 m tile pitch and a 7.35 m half-span in authored space', () => {
    expect(GOMOKU_ARENA_TILE_PITCH_M).toBeCloseTo(1.05, 6);
    expect(GOMOKU_ARENA_FIELD_HALF_M).toBeCloseTo(7.35, 6);
    expect(GOMOKU_ARENA_WORLD_SCALE * GOMOKU_ARENA_TILE_PITCH_M).toBeCloseTo(1, 8);
  });

  it('maps authored cell nodes to the 15×15 placement grid within tolerance', () => {
    const errors: number[] = [];
    for (let row = 0; row < GOMOKU_DIMS.GRID; row++) {
      for (let col = 0; col < GOMOKU_DIMS.GRID; col++) {
        errors.push(gomokuArenaPlacementError(row, col));
        const target = gomokuCellWorld(GOMOKU_DIMS.GRID, row, col);
        const arena = gomokuArenaCellWorldXz(row, col);
        expect(arena.x).toBeCloseTo(target.x, 4);
        expect(arena.y).toBeCloseTo(target.z, 4);
      }
    }
    expect(Math.max(...errors)).toBeLessThan(0.02);
  });

  it('centres the field on the board origin', () => {
    const mid = Math.floor(GOMOKU_DIMS.GRID / 2);
    const center = gomokuArenaCellWorldXz(mid, mid);
    expect(center.x).toBeCloseTo(0, 4);
    expect(center.y).toBeCloseTo(0, 4);
    const corner = gomokuArenaCellAuthoredXz(0, 0);
    expect(corner.x).toBeCloseTo(-GOMOKU_ARENA_FIELD_HALF_M, 4);
    expect(corner.z).toBeCloseTo(GOMOKU_ARENA_FIELD_HALF_M, 4);
  });
});
