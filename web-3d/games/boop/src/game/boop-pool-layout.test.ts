import { describe, expect, it } from 'vitest';
import { cellCoordinates, cellIndex } from '@abstract/three-engine';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';
import {
  BOOP_START_POOL_COUNTS,
  handPieceCount,
  handSlotStartIndex,
  POOL_GAP_CELLS_FROM_BED,
  poolOccupiedCells,
  poolSlots,
  primaryPoolCellIndex,
} from './boop-pool-layout';
import { PieceTracker } from './piece-tracker';
import { parseGameView } from './types';

function handPiecesInSnapshot(
  snap: ReturnType<PieceTracker['buildSnapshot']>,
  player: 'A' | 'B',
  handCol: number,
) {
  let kittens = 0;
  let cats = 0;
  snap.cells.forEach((stack, idx) => {
    const { col } = cellCoordinates(BOOP_GRID, idx, BOOP_OUTSIDE);
    if (col !== handCol) return;
    for (const p of stack) {
      if (p.player !== player) continue;
      if (p.shape === 'kitten') kittens++;
      else if (p.shape === 'cat') cats++;
    }
  });
  return { kittens, cats, total: kittens + cats };
}

describe('boop pool layout', () => {
  it('does not place pool pieces on row −1 above the bed', () => {
    for (const player of ['A', 'B'] as const) {
      for (const slot of poolSlots(player, 'cat_hand')) {
        expect(slot.row).toBeGreaterThanOrEqual(0);
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
      const front = poolSlots(player, 'cat_hand')[0]!;
      const primary = primaryPoolCellIndex(player, 'kitten', BOOP_START_POOL_COUNTS);
      expect(primary).toBe(cellIndex(BOOP_GRID, front.row, front.col, BOOP_OUTSIDE));
    }
    const startHand = poolOccupiedCells('A', BOOP_START_POOL_COUNTS);
    expect(startHand.length).toBe(BOOP_START_POOL_COUNTS.kittens_in_hand);
    expect(startHand.every(c => c.col === -3)).toBe(true);
  });

  it('shows zero hand cats at new game (no hidden reserve vases)', () => {
    const tracker = new PieceTracker();
    tracker.resetFromNewGame();
    const view = parseGameView(
      JSON.stringify({
        to_move: 'A',
        winner: null,
        turn_mode: { kind: 'place' },
        board: Array.from({ length: BOOP_GRID }, () => Array.from({ length: BOOP_GRID }, () => null)),
        pools: [BOOP_START_POOL_COUNTS, BOOP_START_POOL_COUNTS],
        effects: { displacements: [], off_board: [], line_highlight: null, graduated_cells: null },
      }),
    );
    tracker.syncBoard(view);
    const snap = tracker.buildSnapshot(view);
    const handCol = poolSlots('A', 'cat_hand')[0]!.col;
    const { kittens, cats, total } = handPiecesInSnapshot(snap, 'A', handCol);
    expect(cats).toBe(0);
    expect(kittens).toBe(8);
    expect(total).toBe(handPieceCount(BOOP_START_POOL_COUNTS));
    let reserveColCats = 0;
    snap.cells.forEach((stack, idx) => {
      const { col } = cellCoordinates(BOOP_GRID, idx, BOOP_OUTSIDE);
      if (col === handCol - 1) reserveColCats += stack.filter(p => p.shape === 'cat').length;
    });
    expect(reserveColCats).toBe(0);
  });

  it('places graduated hand cats in the low hand slots formerly used by kittens', () => {
    const afterGrad = {
      kittens_in_hand: 5,
      cats_in_hand: 3,
      cats_in_reserve: 5,
    };
    expect(handSlotStartIndex('kitten', afterGrad)).toBe(3);
    const occupied = poolOccupiedCells('A', afterGrad);
    expect(occupied.length).toBe(handPieceCount(afterGrad));
    const handCol = poolSlots('A', 'cat_hand')[0]!.col;
    const catRows = occupied.filter((_, i) => i < afterGrad.cats_in_hand).map(s => s.row);
    expect(catRows).toEqual([0, 1, 2]);
    expect(occupied.every(s => s.col === handCol)).toBe(true);

    const view = parseGameView(
      JSON.stringify({
        to_move: 'B',
        winner: null,
        turn_mode: { kind: 'place' },
        board: Array.from({ length: BOOP_GRID }, () => Array.from({ length: BOOP_GRID }, () => null)),
        pools: [afterGrad, BOOP_START_POOL_COUNTS],
        effects: { displacements: [], off_board: [], line_highlight: null, graduated_cells: null },
      }),
    );
    const tracker = new PieceTracker();
    tracker.resetFromNewGame();
    tracker.syncBoard(view);
    const snap = tracker.buildSnapshot(view);
    const counts = handPiecesInSnapshot(snap, 'A', handCol);
    expect(counts.cats).toBe(afterGrad.cats_in_hand);
    expect(counts.kittens).toBe(afterGrad.kittens_in_hand);
    expect(counts.total).toBe(handPieceCount(afterGrad));
  });

  it('matches visual hand piece count to rules hand counts', () => {
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
    const pool = view.pools[0]!;
    const counts = handPiecesInSnapshot(snap, 'A', handCol);
    expect(counts.kittens).toBe(pool.kittens_in_hand);
    expect(counts.cats).toBe(pool.cats_in_hand);
    expect(counts.total).toBe(pool.kittens_in_hand + pool.cats_in_hand);
  });
});
