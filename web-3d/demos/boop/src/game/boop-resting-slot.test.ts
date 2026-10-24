import { describe, expect, it } from 'vitest';
import { cellIndex } from '@abstract/three-engine';
import { defaultRestingCell, resolveRestingCell } from './boop-resting-slot';
import { PieceTracker } from './piece-tracker';

const GRID = 6;
const OUTSIDE = 2;

describe('defaultRestingCell', () => {
  it('maps a left-edge boop to the exterior column', () => {
    expect(defaultRestingCell({ x: 0, y: 2 }, { push_x: -1, push_y: 0 })).toEqual({ row: 2, col: -1 });
  });
});

describe('resolveRestingCell', () => {
  it('slides outward along the off-board row when the default cell is taken', () => {
    const push = { push_x: -1, push_y: 0 };
    const occupants = [{ row: 2, col: -1 }];
    const slot = resolveRestingCell({ x: 0, y: 2 }, push, occupants);
    expect(slot).toEqual({ row: 2, col: -2 });
    expect(cellIndex(GRID, slot.row, slot.col, OUTSIDE)).not.toBeNull();
  });

  it('keeps the default cell when nothing occupies it', () => {
    const push = { push_x: -1, push_y: 0 };
    expect(resolveRestingCell({ x: 0, y: 2 }, push, [])).toEqual({ row: 2, col: -1 });
  });

});

describe('PieceTracker resting overlap', () => {
  it('assigns distinct exterior cells when the default spot is taken', () => {
    const tracker = new PieceTracker();
    tracker.resetFromNewGame();
    const push = { push_x: -1, push_y: 0 };
    const first = defaultRestingCell({ x: 0, y: 0 }, push);
    tracker.addResting('vase-a', 'B', 'kitten', first.row, first.col);
    const naiveSecond = defaultRestingCell({ x: 0, y: 0 }, push);
    expect(naiveSecond).toEqual(first);

    const resolved = tracker.resolveRestingSlot({ x: 0, y: 0 }, push);
    expect(resolved).not.toEqual(first);
    tracker.addResting('vase-b', 'B', 'kitten', resolved.row, resolved.col);

    const snap = tracker.buildSnapshot({
      to_move: 'A',
      winner: null,
      turn_mode: { kind: 'place' },
      board: Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => null)),
      pools: [
        { kittens_in_hand: 7, cats_in_hand: 2, cats_in_reserve: 0 },
        { kittens_in_hand: 7, cats_in_hand: 2, cats_in_reserve: 0 },
      ],
      effects: { displacements: [], off_board: [], line_highlight: null, graduated_cells: null },
    });

    const cellOf = (id: string) => snap.cells.findIndex(stack => stack.some(p => p.id === id));
    expect(cellOf('vase-a')).toBeGreaterThanOrEqual(0);
    expect(cellOf('vase-b')).toBeGreaterThanOrEqual(0);
    expect(cellOf('vase-a')).not.toBe(cellOf('vase-b'));
    expect(resolved.col).toBeLessThan(first.col);
  });

  it('still picks a specific resting piece by preferred id when several are nearby', () => {
    const tracker = new PieceTracker();
    tracker.resetFromNewGame();
    tracker.addResting('near', 'A', 'kitten', 0, -1);
    tracker.addResting('far', 'A', 'kitten', 0, -2);
    const taken = tracker.takeForPlacement('A', 'kitten', 'far');
    expect(taken).toMatchObject({ id: 'far', from: 'resting', restRow: 0, restCol: -2 });
    expect(tracker.restingCount()).toBe(1);
  });
});
