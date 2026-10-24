import { describe, expect, it } from 'vitest';
import { boardAfterDisplacements } from './boop-push-board';
import { exportDualAdjacentBoopSetup } from './boop-push-fixture';
import {
  applyParallelBoopPushEffects,
  BOOP_PUSH_ANIMATION_PHASES,
  boopPushAnimationPhaseCount,
} from './boop-push-schedule';
import { PieceTracker } from './piece-tracker';
import type { GameView } from './types';

function emptyBed(): GameView['board'] {
  return Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => null));
}

function baseView(board: GameView['board']): GameView {
  return {
    to_move: 'A',
    winner: null,
    turn_mode: { kind: 'place' },
    board,
    pools: [
      { kittens_in_hand: 7, cats_in_hand: 2, cats_in_reserve: 0 },
      { kittens_in_hand: 7, cats_in_hand: 2, cats_in_reserve: 0 },
    ],
    effects: { displacements: [], off_board: [], line_highlight: null, graduated_cells: null },
  };
}

describe('parallel boop push scheduling', () => {
  it('uses one animation phase for multiple displacements and off-board exits', () => {
    expect(boopPushAnimationPhaseCount({ displacements: [], off_board: [] })).toBe(0);
    expect(
      boopPushAnimationPhaseCount({
        displacements: [
          { from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, player: 'B', kind: 'kitten' },
          { from: { x: 0, y: 1 }, to: { x: 0, y: 2 }, player: 'B', kind: 'kitten' },
        ],
        off_board: [{ from: { x: 0, y: 0 }, player: 'B', kind: 'kitten', push_x: -1, push_y: 0 }],
      }),
    ).toBe(BOOP_PUSH_ANIMATION_PHASES);
  });

  it('keeps each displaced piece id in the post-push snapshot (single transition)', () => {
    const board = emptyBed();
    board[0]![1] = { player: 'B', kind: 'kitten' };
    board[1]![0] = { player: 'B', kind: 'kitten' };
    const pushBase = baseView(board);
    const displacements = [
      { from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, player: 'B' as const, kind: 'kitten' as const },
      { from: { x: 0, y: 1 }, to: { x: 0, y: 2 }, player: 'B' as const, kind: 'kitten' as const },
    ];
    const afterBoard = emptyBed();
    afterBoard[0]![2] = { player: 'B', kind: 'kitten' };
    afterBoard[2]![0] = { player: 'B', kind: 'kitten' };
    const afterMeta = baseView(afterBoard);

    const tracker = new PieceTracker();
    tracker.resetFromNewGame();
    tracker.syncBoard(pushBase);
    const idEast = tracker.ensureIdAt(1, 0, 'B', 'kitten');
    const idSouth = tracker.ensureIdAt(0, 1, 'B', 'kitten');

    applyParallelBoopPushEffects(tracker, { displacements, off_board: [] });
    const staged = boardAfterDisplacements(pushBase, displacements, displacements.length, afterMeta);
    const snap = tracker.buildSnapshot(staged);
    const ids = snap.cells.flat().map(p => p.id);
    expect(ids).toContain(idEast);
    expect(ids).toContain(idSouth);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exports dual-adjacent boop fixture board cells', () => {
    const stub = {
      export_state: () =>
        JSON.stringify({
          board: emptyBed(),
          pools: [
            { kittens_in_hand: 8, cats_in_hand: 2, cats_in_reserve: 0 },
            { kittens_in_hand: 8, cats_in_hand: 2, cats_in_reserve: 0 },
          ],
          to_move: 'A',
          winner: null,
          pending_graduation: [],
        }),
    };
    const state = JSON.parse(exportDualAdjacentBoopSetup(stub as never)) as { board: GameView['board'] };
    expect(state.board[0]![1]).toEqual({ player: 'B', kind: 'kitten' });
    expect(state.board[1]![0]).toEqual({ player: 'B', kind: 'kitten' });
  });
});
