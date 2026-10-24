import { describe, expect, it } from 'vitest';
import { PieceTracker } from './piece-tracker';
import { boardAfterDisplacements, boardWithOffBoardOnBed } from './boop-push-board';
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

describe('boardAfterDisplacements', () => {
  it('does not advance later chain steps early', () => {
    const board = emptyBed();
    board[0]![0] = { player: 'A', kind: 'kitten' };
    board[0]![1] = { player: 'B', kind: 'kitten' };
    board[0]![2] = { player: 'A', kind: 'kitten' };
    const base = baseView(board);
    const displacements = [
      { from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, player: 'B' as const, kind: 'kitten' as const },
      { from: { x: 2, y: 0 }, to: { x: 3, y: 0 }, player: 'A' as const, kind: 'kitten' as const },
    ];
    const afterMeta = baseView(emptyBed());
    afterMeta.board[0]![3] = { player: 'A', kind: 'kitten' };
    afterMeta.board[0]![2] = { player: 'B', kind: 'kitten' };

    const step1 = boardAfterDisplacements(base, displacements, 1, afterMeta);
    expect(step1.board[0]![3]).toBeNull();
    expect(step1.board[0]![2]?.player).toBe('B');
    expect(step1.board[0]![1]).toBeNull();
  });
});

describe('push snapshot continuity', () => {
  it('keeps each moving piece id present across staged snapshots', () => {
    const board = emptyBed();
    board[0]![0] = { player: 'B', kind: 'kitten' };
    board[0]![1] = { player: 'A', kind: 'kitten' };
    const base = baseView(board);
    const displacements = [
      { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, player: 'B' as const, kind: 'kitten' as const },
    ];
    const tracker = new PieceTracker();
    tracker.resetFromNewGame();
    tracker.syncBoard(base);
    tracker.syncBoard(base);
    const originSnap = tracker.buildSnapshot(base);
    const pushedId = originSnap.cells.flat().find(p => p.player === 'B')?.id;
    expect(pushedId).toBeDefined();

    const staged = boardAfterDisplacements(base, displacements, 1, base);
    tracker.moveBoardId(displacements[0]!.from, displacements[0]!.to);
    const snap = tracker.buildSnapshot(staged);
    const ids = snap.cells.flat().map(p => p.id);
    expect(ids).toContain(pushedId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('boardWithOffBoardOnBed', () => {
  it('restores not-yet-animated off-board pieces on the bed', () => {
    const board = emptyBed();
    const base = baseView(board);
    const offBoard = [{ from: { x: 0, y: 0 }, player: 'B' as const, kind: 'kitten' as const, push_x: -1, push_y: 0 }];
    const staged = boardWithOffBoardOnBed(base, offBoard, 0);
    expect(staged.board[0]![0]).toEqual({ player: 'B', kind: 'kitten' });
  });
});
