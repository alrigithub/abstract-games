import { describe, expect, it } from 'vitest';
import { BOOP_GRID } from './boop-grid';
import { POOL_GAP_CELLS_FROM_BED, poolSlots } from './boop-pool-layout';

function cellCenterX(col: number): number {
  return col - (BOOP_GRID - 1) / 2;
}

describe('boop arena side trays vs pool columns', () => {
  it('places the nearest pool column on the 3rd exterior cell from the bed edge', () => {
    for (const player of ['A', 'B'] as const) {
      const handCol = poolSlots(player, 'cat_hand')[0]!.col;
      const bedEdge = player === 'A' ? 0 : BOOP_GRID - 1;
      const cellsOut = player === 'A' ? bedEdge - handCol : handCol - bedEdge;
      expect(cellsOut).toBe(POOL_GAP_CELLS_FROM_BED + 1);
    }
  });

  it('keeps hand and reserve stacks on the same side of the bed as the arena trays', () => {
    const handA = cellCenterX(poolSlots('A', 'cat_hand')[0]!.col);
    const handB = cellCenterX(poolSlots('B', 'cat_hand')[0]!.col);
    expect(handA).toBeLessThan(-2.5);
    expect(handB).toBeGreaterThan(2.5);
  });
});
