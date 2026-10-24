import { describe, expect, it } from 'vitest';
import { Board, checkRunResultHasRun, checkRunResultNoRuns } from './board';
import {
  allCoords,
  coordAdd,
  coordMul,
  coordNew,
  DIRECTIONS,
  directionVector,
  isInsideBoard,
} from './coord';
import { gameStateToSnapshot } from './snapshot';
import { movesInclude, possibleMoves } from './moves';
import { GameState } from './state';
import { listRunOptions } from './runs';

describe('coord grid', () => {
  it('has 85 playable intersections', () => {
    expect(allCoords().length).toBe(85);
  });
});

describe('board check_run (from rust board tests)', () => {
  it('detects five in a row on an axis', () => {
    const board = Board.empty();
    expect(checkRunResultNoRuns(board.checkRun())).toBe(true);

    board.addMarker('A', coordNew(0, -2));
    board.addMarker('A', coordNew(0, -1));
    board.addMarker('A', coordNew(0, 0));
    board.addMarker('A', coordNew(0, 1));
    expect(checkRunResultNoRuns(board.checkRun())).toBe(true);

    board.addMarker('A', coordNew(0, 2));
    expect(checkRunResultHasRun(board.checkRun(), 'A')).toBe(true);
    expect(checkRunResultHasRun(board.checkRun(), 'B')).toBe(false);
  });

  it('detects a row of six markers and offers removable fives', () => {
    const board = Board.empty();
    for (let y = -2; y <= 3; y++) {
      board.addMarker('A', coordNew(0, y));
    }
    expect(checkRunResultHasRun(board.checkRun(), 'A')).toBe(true);
    const options = listRunOptions(board, 'A');
    expect(options.length).toBeGreaterThanOrEqual(1);
    for (const opt of options) {
      expect(opt.five).toHaveLength(5);
      expect(opt.chain.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('matches exhaustive direction runs', () => {
    for (const c of allCoords()) {
      for (const d of DIRECTIONS) {
        const far = coordAdd(c, coordMul(directionVector(d), 4));
        if (isInsideBoard(far)) {
          const board = Board.empty();
          for (let i = 0; i <= 4; i++) {
            board.addMarker('A', coordAdd(c, coordMul(directionVector(d), i)));
          }
          expect(checkRunResultHasRun(board.checkRun(), 'A')).toBe(true);
        }
      }
    }
  });
});

describe('flip_markers_between after ring move', () => {
  it('flips jumped markers to the moving player', () => {
    const board = Board.empty();
    const start = coordNew(0, 0);
    const end = coordNew(0, -3);
    board.addMarker('A', start);
    board.addMarker('B', coordNew(0, -1));
    board.addMarker('B', coordNew(0, -2));
    board.addRing('A', end);
    board.flipMarkersBetween(start, end);

    expect(board.elementColorAt(coordNew(0, -1))).toBe('A');
    expect(board.elementColorAt(coordNew(0, -2))).toBe('A');
    expect(board.numMarkers('A')).toBe(3);
    expect(board.numMarkers('B')).toBe(0);
  });
});

describe('GameState run removal flow', () => {
  it('enters run removal when a row of six is on the board after a ring move', () => {
    const state = GameState.initial();
    for (let y = -2; y <= 3; y++) {
      state.board.addMarker('A', coordNew(0, y));
    }
    const start = coordNew(3, 0);
    const end = coordNew(4, 0);
    state.board.addRing('A', start);
    state.activePlayer = 'A';
    state.turnMode = { tag: 'RingMovement', start };
    const move = { tag: 'MoveRing' as const, start, end };
    expect(movesInclude(possibleMoves(state), move)).toBe(true);

    state.performMove(move);

    expect(['WaitForRunRemoval', 'RunRemoval']).toContain(state.turnMode.tag);
    expect(checkRunResultHasRun(state.board.checkRun(), 'A')).toBe(true);
    expect(listRunOptions(state.board, 'A').length).toBeGreaterThan(0);
  });

  it('ring path flips can complete a sixth marker in a row', () => {
    const board = Board.empty();
    const start = coordNew(0, 0);
    const end = coordNew(0, -3);
    board.addRing('A', end);
    board.addMarker('A', start);
    board.addMarker('B', coordNew(0, -1));
    board.addMarker('B', coordNew(0, -2));
    for (let y = 1; y <= 3; y++) {
      board.addMarker('A', coordNew(0, y));
    }
    expect(checkRunResultHasRun(board.checkRun(), 'A')).toBe(false);
    board.flipMarkersBetween(start, end);
    expect(checkRunResultHasRun(board.checkRun(), 'A')).toBe(true);
    expect(listRunOptions(board, 'A').length).toBeGreaterThan(0);
  });
});

describe('GameState scoring and winner', () => {
  it('remove_run awards a point to the active remover', () => {
    const state = GameState.initial();
    for (let y = -2; y <= 2; y++) {
      state.board.addMarker('A', coordNew(0, y));
    }
    state.activePlayer = 'A';
    state.turnMode = { tag: 'RunRemoval', playerLastRingMove: 'B' };

    state.performMove({ tag: 'RemoveRun', coord: coordNew(0, 0) });

    expect(state.pointsA).toBe(1);
    expect(state.board.numMarkers('A')).toBe(0);
    expect(state.activePlayer).toBe('B');
  });

  it('declares winner at three points', () => {
    const state = GameState.initial();
    state.pointsA = 3;
    expect(state.winner()).toBe('A');

    state.pointsA = 2;
    state.pointsB = 3;
    expect(state.winner()).toBe('B');
  });
});

describe('snapshot reserves', () => {
  it('reflects hand rings and scored racks', () => {
    const state = GameState.initial();
    state.board.addRing('A', coordNew(1, 0));
    state.board.addRing('A', coordNew(2, 0));
    state.pointsA = 2;
    state.pointsB = 1;

    const snap = gameStateToSnapshot(state);
    const handA = snap.reserves?.find(r => r.id === 'hand-A');
    expect(handA?.count).toBe(3);

    expect(snap.reserves?.find(r => r.id === 'rack-A-0')?.count).toBe(1);
    expect(snap.reserves?.find(r => r.id === 'rack-A-1')?.count).toBe(1);
    expect(snap.reserves?.find(r => r.id === 'rack-A-2')?.count).toBe(0);
    expect(snap.reserves?.find(r => r.id === 'rack-B-0')?.count).toBe(1);
  });
});
