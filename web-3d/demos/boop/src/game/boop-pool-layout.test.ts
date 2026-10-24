import { describe, expect, it } from 'vitest';
import { cellCoordinates, cellIndex } from '@abstract/three-engine';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';
import {
  BOOP_START_POOL_COUNTS,
  kittenHandColumn,
  POOL_GAP_CELLS_FROM_BED,
  poolOccupiedCells,
  poolSlots,
  primaryPoolCellIndex,
} from './boop-pool-layout';
import { PieceTracker } from './piece-tracker';
import { parseGameView } from './types';

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

  it('leaves two empty columns between the bed and the nearest pool stack', () => {
    for (const player of ['A', 'B'] as const) {
      const frontCol = poolSlots(player, 'cat_hand')[0]!.col;
      const bedEdge = player === 'A' ? 0 : BOOP_GRID - 1;
      const gap = player === 'A' ? bedEdge - frontCol - 1 : frontCol - bedEdge - 1;
      expect(gap).toBe(POOL_GAP_CELLS_FROM_BED);
    }
  });

  it('starts with small vases in the front hand column (no empty big-vase gap)', () => {
    for (const player of ['A', 'B'] as const) {
      expect(kittenHandColumn(player, BOOP_START_POOL_COUNTS)).toBe('cat_hand');
      const front = poolSlots(player, 'cat_hand')[0]!;
      const primary = primaryPoolCellIndex(player, 'kitten', BOOP_START_POOL_COUNTS);
      expect(primary).toBe(cellIndex(BOOP_GRID, front.row, front.col, BOOP_OUTSIDE));
    }
    const startHand = poolOccupiedCells('A', BOOP_START_POOL_COUNTS).filter(c => c.col === -3);
    expect(startHand.length).toBe(BOOP_START_POOL_COUNTS.kittens_in_hand);
    expect(startHand.every(c => c.col === -3)).toBe(true);
    expect(startHand.some(c => c.col === -6)).toBe(false);
  });

  it('moves kittens to the rear column once hand cats exist after graduation', () => {
    const afterGrad: typeof BOOP_START_POOL_COUNTS = {
      kittens_in_hand: 5,
      cats_in_hand: 3,
      cats_in_reserve: 5,
    };
    expect(kittenHandColumn('A', afterGrad)).toBe('kitten');
    const occupied = poolOccupiedCells('A', afterGrad);
    const cols = new Set(occupied.map(c => c.col));
    expect(cols.has(-3)).toBe(true);
    expect(cols.has(-6)).toBe(true);
    expect(cols.has(-4)).toBe(true);
  });

  it('keeps hand, reserve, and resting columns disjoint for each player after graduation', () => {
    const a = poolOccupiedCells('A', { kittens_in_hand: 8, cats_in_hand: 3, cats_in_reserve: 5 });
    const cols = new Set(a.map(c => c.col));
    expect(cols.size).toBe(3);
    expect(cols.has(-4)).toBe(true);
    expect(cols.has(-6)).toBe(true);
    expect(cols.has(-3)).toBe(true);
    for (const slot of a) {
      expect(cellIndex(BOOP_GRID, slot.row, slot.col, BOOP_OUTSIDE)).not.toBeNull();
    }
  });

  it('renders graduated hand cats in the hand column without overlapping reserve slots', () => {
    const view = parseGameView(
      JSON.stringify({
        to_move: 'B',
        winner: null,
        turn_mode: { kind: 'place' },
        board: Array.from({ length: BOOP_GRID }, () => Array.from({ length: BOOP_GRID }, () => null)),
        pools: [
          { kittens_in_hand: 5, cats_in_hand: 3, cats_in_reserve: 5 },
          { kittens_in_hand: 8, cats_in_hand: 0, cats_in_reserve: 8 },
        ],
        effects: { displacements: [], off_board: [], line_highlight: null, graduated_cells: null },
      }),
    );
    const tracker = new PieceTracker();
    tracker.resetFromNewGame();
    tracker.syncBoard(view);
    const snap = tracker.buildSnapshot(view);
    const handCol = poolSlots('A', 'cat_hand')[0]!.col;
    let handCats = 0;
    snap.cells.forEach((stack, idx) => {
      const { col } = cellCoordinates(BOOP_GRID, idx, BOOP_OUTSIDE);
      if (col !== handCol) return;
      handCats += stack.filter(p => p.player === 'A' && p.shape === 'cat').length;
    });
    expect(handCats).toBe(3);
  });
});
