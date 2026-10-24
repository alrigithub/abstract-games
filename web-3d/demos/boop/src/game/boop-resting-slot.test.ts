import { describe, expect, it } from 'vitest';
import { cellIndex } from '@abstract/three-engine';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';
import { poolOccupiedCells } from './boop-pool-layout';
import { defaultRestingCell, resolveRestingCell } from './boop-resting-slot';
import { PieceTracker } from './piece-tracker';

describe('defaultRestingCell', () => {
  it('places white resting pieces in the far-left column aligned with bed row', () => {
    expect(defaultRestingCell({ x: 0, y: 2 }, { push_x: -1, push_y: 0 }, 'A')).toEqual({ row: 2, col: -2 });
  });

  it('places black resting pieces in the far-right column', () => {
    expect(defaultRestingCell({ x: 5, y: 1 }, { push_x: 1, push_y: 0 }, 'B')).toEqual({ row: 1, col: 7 });
  });
});

describe('resolveRestingCell', () => {
  it('rests on the near gap column without overlapping outward pool stacks', () => {
    const blocked = poolOccupiedCells('A', { kittens_in_hand: 8, cats_in_hand: 0, cats_in_reserve: 8 });
    const slot = resolveRestingCell({ x: 0, y: 2 }, { push_x: -1, push_y: 0 }, [], 'A', blocked);
    expect(slot.col).toBe(-2);
    expect(blocked.some(b => b.row === slot.row && b.col === slot.col)).toBe(false);
    expect(cellIndex(BOOP_GRID, slot.row, slot.col, BOOP_OUTSIDE)).not.toBeNull();
  });

  it('slides to another row on the owner column when the preferred row is taken', () => {
    const slot = resolveRestingCell(
      { x: 0, y: 2 },
      { push_x: -1, push_y: 0 },
      [{ row: 2, col: -2 }],
      'A',
      [],
    );
    expect(slot.col).toBe(-2);
    expect(slot.row).not.toBe(2);
  });

  it('keeps white and black resting on opposite sides', () => {
    const white = resolveRestingCell({ x: 0, y: 0 }, { push_x: -1, push_y: 0 }, [], 'A', []);
    const black = resolveRestingCell({ x: 5, y: 0 }, { push_x: 1, push_y: 0 }, [], 'B', []);
    expect(white.col).toBeLessThan(0);
    expect(black.col >= BOOP_GRID).toBe(true);
  });
});

describe('PieceTracker resting overlap', () => {
  it('assigns distinct exterior cells when the default spot is taken', () => {
    const tracker = new PieceTracker();
    tracker.resetFromNewGame();
    const push = { push_x: -1, push_y: 0 };
    const first = tracker.resolveRestingSlot({ x: 0, y: 0 }, push, 'B');
    tracker.addResting('vase-a', 'B', 'kitten', first.row, first.col);
    const resolved = tracker.resolveRestingSlot({ x: 0, y: 0 }, push, 'B');
    expect(resolved).not.toEqual(first);
    tracker.addResting('vase-b', 'B', 'kitten', resolved.row, resolved.col);

    const snap = tracker.buildSnapshot({
      to_move: 'A',
      winner: null,
      turn_mode: { kind: 'place' },
      board: Array.from({ length: BOOP_GRID }, () => Array.from({ length: BOOP_GRID }, () => null)),
      pools: [
        { kittens_in_hand: 7, cats_in_hand: 2, cats_in_reserve: 5 },
        { kittens_in_hand: 7, cats_in_hand: 2, cats_in_reserve: 5 },
      ],
      effects: { displacements: [], off_board: [], line_highlight: null, graduated_cells: null },
    });

    const cellOf = (id: string) => snap.cells.findIndex(stack => stack.some(p => p.id === id));
    expect(cellOf('vase-a')).toBeGreaterThanOrEqual(0);
    expect(cellOf('vase-b')).toBeGreaterThanOrEqual(0);
    expect(cellOf('vase-a')).not.toBe(cellOf('vase-b'));
  });
});
