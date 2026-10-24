import { describe, expect, it } from 'vitest';
import { BOOP_GRID } from './boop-grid';
import { playerRestingColumn, poolSlots } from './boop-pool-layout';

/** Side-tray floor centroids from `White_Earth` (after {@link BOOP_ARENA_WORLD_CORRECTION}). */
const SIDE_TRAY_CENTER_X = { A: -3.72, B: 4.0 } as const;

function cellCenterX(col: number): number {
  return col - (BOOP_GRID - 1) / 2;
}

describe('boop arena side depressions vs pool columns', () => {
  it('places reserve stacks in the authored side tray for each player', () => {
    for (const player of ['A', 'B'] as const) {
      const reserveCol = playerRestingColumn(player);
      const reserveX = cellCenterX(reserveCol);
      expect(Math.abs(reserveX - SIDE_TRAY_CENTER_X[player])).toBeLessThan(1.1);
    }
  });

  it('keeps hand cats adjacent to the same side tray (west / east of bed)', () => {
    const handA = poolSlots('A', 'cat_hand')[0]!.col;
    const handB = poolSlots('B', 'cat_hand')[0]!.col;
    expect(Math.abs(cellCenterX(handA) - SIDE_TRAY_CENTER_X.A)).toBeLessThan(1.2);
    expect(Math.abs(cellCenterX(handB) - SIDE_TRAY_CENTER_X.B)).toBeLessThan(1.2);
  });
});
