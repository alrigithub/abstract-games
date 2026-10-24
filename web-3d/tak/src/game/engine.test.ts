import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createGame,
  flatCounts,
  hasRoad,
  isLegalMove,
  legalMoves,
  ownedFromTop,
  placementColor,
  reservePieces,
  type GameState,
  type Move,
} from './engine';
import { chooseMove } from './ai';
import { reserveSupply } from '../state';
import type { Color, Orientation, Piece, PieceKind } from '../types';

function place(game: GameState, to: number, kind: PieceKind = 'stone', orientation: Orientation = 'flat'): GameState {
  const move: Move = { type: 'place', to, kind, orientation };
  expect(isLegalMove(game, move)).toBe(true);
  return applyMove(game, move);
}

function finishOpening(game: GameState): GameState {
  let g = place(game, 0);
  g = place(g, game.board.size ** 2 - 1);
  expect(g.ply).toBe(2);
  return g;
}

function setStack(game: GameState, cell: number, stack: Piece[]): GameState {
  const cells = game.board.cells.slice();
  cells[cell] = stack;
  return { ...game, board: { ...game.board, cells } };
}

function flat(color: Color, id: string): Piece {
  return { id, color, kind: 'stone', orientation: 'flat' };
}

function wall(color: Color, id: string): Piece {
  return { id, color, kind: 'stone', orientation: 'standing' };
}

function cap(color: Color, id: string): Piece {
  return { id, color, kind: 'capstone', orientation: 'flat' };
}

describe('Tak 5×5 rules', () => {
  it('starts with 21 stones and 1 capstone per player in reserve', () => {
    const game = createGame(5);
    expect(reserveSupply(5)).toEqual({ stone: 21, capstone: 1 });
    expect(reservePieces(game, 'ivory', 'stone')).toHaveLength(21);
    expect(reservePieces(game, 'charcoal', 'stone')).toHaveLength(21);
    expect(reservePieces(game, 'ivory', 'capstone')).toHaveLength(1);
    expect(reservePieces(game, 'charcoal', 'capstone')).toHaveLength(1);
  });

  it('opening places opponent flats only', () => {
    const game = createGame(5);
    expect(placementColor(game)).toBe('charcoal');
    expect(legalMoves(game).every(m => m.type === 'place' && m.kind === 'stone' && m.orientation === 'flat')).toBe(true);
    const after = place(game, 12);
    expect(after.board.cells[12]!.at(-1)?.color).toBe('charcoal');
    expect(after.toMove).toBe('charcoal');
    expect(reservePieces(after, 'charcoal', 'stone')).toHaveLength(20);
    expect(reservePieces(after, 'ivory', 'stone')).toHaveLength(21);
  });

  it('rejects walls and capstones during opening', () => {
    const game = createGame(5);
    expect(isLegalMove(game, { type: 'place', to: 0, kind: 'stone', orientation: 'standing' })).toBe(false);
    expect(isLegalMove(game, { type: 'place', to: 0, kind: 'capstone', orientation: 'flat' })).toBe(false);
    expect(legalMoves(finishOpening(createGame(5))).some(m => m.type === 'spread')).toBe(true);
  });

  it('allows flat, wall, and cap placement after opening', () => {
    const game = finishOpening(createGame(5));
    expect(legalMoves(game).some(m => m.type === 'place' && m.orientation === 'flat')).toBe(true);
    expect(legalMoves(game).some(m => m.type === 'place' && m.orientation === 'standing')).toBe(true);
    expect(legalMoves(game).some(m => m.type === 'place' && m.kind === 'capstone')).toBe(true);
  });

  it('spread picks up only contiguous owned pieces from the top', () => {
    const game = finishOpening(createGame(5));
    const mixed = setStack(game, 12, [flat('charcoal', 'b1'), flat('ivory', 'i1'), flat('ivory', 'i2')]);
    expect(ownedFromTop(mixed.board.cells[12]!, 'ivory')).toBe(2);
    expect(legalMoves({ ...mixed, toMove: 'ivory' }).some(m => m.type === 'spread' && m.from === 12 && m.drops.reduce((a, b) => a + b, 0) === 3)).toBe(false);
    expect(legalMoves({ ...mixed, toMove: 'ivory' }).some(m => m.type === 'spread' && m.from === 12 && m.drops.reduce((a, b) => a + b, 0) === 2)).toBe(true);
  });

  it('walls block stacks and capstones alone flatten walls on landing', () => {
    let game = finishOpening(createGame(5));
    game = setStack({ ...game, toMove: 'ivory' }, 12, [wall('charcoal', 'w1')]);
    game = setStack({ ...game, toMove: 'ivory' }, 11, [cap('ivory', 'c1')]);
    const capMove: Move = { type: 'spread', from: 11, direction: 'east', drops: [1] };
    expect(isLegalMove(game, capMove)).toBe(true);
    const next = applyMove(game, capMove);
    expect(next.board.cells[12]!.at(-1)?.kind).toBe('capstone');
    expect(next.board.cells[12]!.some(p => p.orientation === 'standing')).toBe(false);
  });

  it('cannot stack on a capstone', () => {
    let game = finishOpening(createGame(5));
    game = setStack({ ...game, toMove: 'ivory' }, 7, [cap('charcoal', 'c1')]);
    game = setStack({ ...game, toMove: 'ivory' }, 6, [flat('ivory', 'f1'), flat('ivory', 'f2')]);
    expect(isLegalMove(game, { type: 'spread', from: 6, direction: 'east', drops: [1] })).toBe(false);
  });

  it('roads count flats and capstones but not walls', () => {
    const size = 5;
    let board = createGame(size).board;
    for (let x = 0; x < size; x++) {
      const cells = board.cells.slice();
      cells[x + 2 * size] = [x === 2 ? cap('ivory', `c${x}`) : flat('ivory', `f${x}`)];
      board = { ...board, cells };
    }
    expect(hasRoad(board, 'ivory')).toBe(true);
    const cells = board.cells.slice();
    cells[2 + 2 * size] = [wall('ivory', 'w')];
    expect(hasRoad({ ...board, cells }, 'ivory')).toBe(false);
  });

  it('mover wins when both players complete roads on the same move', () => {
    let game = finishOpening(createGame(5));
    const size = 5;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x === 2 && y === 2) continue;
        const color: Color = y === 0 ? 'ivory' : y === 4 ? 'charcoal' : 'ivory';
        game = setStack(game, x + y * size, [flat(color, `${x}-${y}`)]);
      }
    }
    game = { ...game, toMove: 'ivory' };
    const win = applyMove(game, { type: 'place', to: 12, kind: 'stone', orientation: 'flat' });
    expect(win.result?.winner).toBe('ivory');
    expect(win.result?.reason).toBe('road');
  });

  it('flat win counts top flats only and ties are draws', () => {
    let game: GameState = { ...createGame(5), ply: 2, toMove: 'charcoal' };
    const size = 5;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x === 4 && y === 4) continue;
        const color: Color = (x + y) % 2 === 0 ? 'ivory' : 'charcoal';
        game = setStack(game, x + y * size, [flat(color, `${x}-${y}`)]);
      }
    }
    const cells = game.board.cells.slice();
    for (let i = size ** 2; i < cells.length; i++) cells[i] = cells[i]!.filter(p => p.kind !== 'stone');
    cells[size ** 2] = [cap('ivory', 'cap')];
    cells[size ** 2 + 1] = [flat('charcoal', 'last')];
    game = { ...game, board: { ...game.board, cells }, toMove: 'charcoal' };
    expect(legalMoves(game).some(m => m.type === 'place' && m.to === size ** 2 - 1 && m.orientation === 'standing')).toBe(true);
    const draw = applyMove(game, { type: 'place', to: size ** 2 - 1, kind: 'stone', orientation: 'standing' });
    expect(draw.result?.winner).toBe(null);
    expect(draw.result?.reason).toBe('flats');
    expect(flatCounts(draw.board).ivory).toBe(flatCounts(draw.board).charcoal);
  });

  it('flat scoring triggers when a player runs out of stones even with a cap left', () => {
    let game = finishOpening(createGame(5));
    const cells = game.board.cells.slice();
    for (let i = game.board.size ** 2; i < cells.length; i++) {
      cells[i] = cells[i]!.filter(p => !(p.color === 'ivory' && p.kind === 'stone'));
    }
    game = { ...game, board: { ...game.board, cells } };
    expect(reservePieces(game, 'ivory', 'stone')).toHaveLength(0);
    expect(reservePieces(game, 'ivory', 'capstone')).toHaveLength(1);
    game = applyMove({ ...game, toMove: 'charcoal' }, { type: 'place', to: 1, kind: 'stone', orientation: 'flat' });
    expect(game.result?.reason).toBe('flats');
  });

  it('AI only returns legal moves and respects finished draws', () => {
    let game = finishOpening(createGame(5));
    for (let i = 0; i < 40; i++) {
      const move = chooseMove(game, { maxDepth: 2, maxNodes: 800 });
      if (!move) break;
      expect(isLegalMove(game, move)).toBe(true);
      game = applyMove(game, move);
    }
    if (game.result?.winner === null) {
      expect(chooseMove(game)).toBe(null);
    }
  });
});
