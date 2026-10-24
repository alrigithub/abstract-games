import { describe, expect, it } from 'vitest';
import { cellIndex } from '@abstract/three-engine';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';
import { poolOccupiedCells, poolSlots } from './boop-pool-layout';

describe('boop pool layout', () => {
  it('does not place pool pieces on row −1 above the bed', () => {
    for (const player of ['A', 'B'] as const) {
      for (const column of ['kitten', 'cat_hand', 'cat_reserve'] as const) {
        for (const slot of poolSlots(player, column)) {
          expect(slot.row).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('keeps hand, reserve, and resting columns disjoint for each player', () => {
    const a = poolOccupiedCells('A', { kittens_in_hand: 8, cats_in_hand: 3, cats_in_reserve: 5 });
    const cols = new Set(a.map(c => c.col));
    expect(cols.size).toBe(3);
    expect(cols.has(-5)).toBe(true);
    expect(cols.has(-2)).toBe(true);
    expect(cols.has(-1)).toBe(true);
    for (const slot of a) {
      expect(cellIndex(BOOP_GRID, slot.row, slot.col, BOOP_OUTSIDE)).not.toBeNull();
    }
  });
});
