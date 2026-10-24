import { describe, expect, it } from 'vitest';
import { applyMove, createGame, type GameState, type Player } from './engine';
import {
  chooseMove,
  chooseMoveWithStats,
  gomokuLevelToSearchOptions,
  GOMOKU_AI_STRENGTH_LEVELS,
} from './ai';
import { winningMoves } from './patterns';

function manual(pieces: { x: number; y: number; p: Player }[], toMove: Player): GameState {
  const cells = Array.from({ length: 225 }, () => null as Player | null);
  for (const { x, y, p } of pieces) cells[y * 15 + x] = p;
  return {
    cells,
    toMove,
    winner: null,
    lastMove: pieces.length ? { x: pieces[pieces.length - 1]!.x, y: pieces[pieces.length - 1]!.y } : null,
    moveCount: pieces.length,
  };
}

function level(id: string) {
  const preset = GOMOKU_AI_STRENGTH_LEVELS.find(l => l.id === id)!;
  return gomokuLevelToSearchOptions(preset);
}

describe('gomoku ai tactics', () => {
  it('takes an immediate winning move', () => {
    const game = manual(
      [0, 1, 2, 3].map(x => ({ x, y: 7, p: 'black' as Player })),
      'black',
    );
    const move = chooseMove(game, level('expert'));
    expect(move?.coord).toEqual({ x: 4, y: 7 });
  });

  it('blocks an opponent open four', () => {
    const game = manual(
      [0, 1, 2, 3].map(x => ({ x, y: 7, p: 'white' as Player })),
      'black',
    );
    const move = chooseMove(game, level('expert'));
    expect(move?.coord).toEqual({ x: 4, y: 7 });
  });

  it('blocks an opponent four with one winning end', () => {
    const game = manual(
      [
        { x: 0, y: 7, p: 'white' },
        { x: 1, y: 7, p: 'white' },
        { x: 2, y: 7, p: 'white' },
        { x: 3, y: 7, p: 'white' },
      ],
      'black',
    );
    const move = chooseMove(game, level('expert'));
    expect(move?.coord).toEqual({ x: 4, y: 7 });
  });

  it('blocks an opponent open three', () => {
    const game = manual(
      [
        { x: 5, y: 7, p: 'white' },
        { x: 6, y: 7, p: 'white' },
        { x: 7, y: 7, p: 'white' },
      ],
      'black',
    );
    const move = chooseMove(game, level('expert'));
    expect([{ x: 4, y: 7 }, { x: 8, y: 7 }]).toContainEqual(move?.coord);
  });

  it('finds a known win-in-two (VCF)', () => {
    const game = manual(
      [
        { x: 4, y: 7, p: 'black' },
        { x: 5, y: 7, p: 'black' },
        { x: 6, y: 7, p: 'black' },
      ],
      'black',
    );
    const move = chooseMove(game, level('expert'));
    expect([{ x: 3, y: 7 }, { x: 7, y: 7 }]).toContainEqual(move?.coord);
    const afterFirst = applyMove(game, move!);
    const mustBlock = winningMoves(afterFirst, 'black')[0]!;
    const afterBlock = applyMove(afterFirst, { type: 'place', coord: mustBlock });
    const finish = applyMove(afterBlock, chooseMove(afterBlock, level('expert'))!);
    expect(finish.winner).toBe('black');
  });
});

describe('gomoku ai self-play', () => {
  it(
    'Expert beats Medium in most short games',
    () => {
      let expertWins = 0;
      const rounds = 10;
      for (let i = 0; i < rounds; i++) {
        const expertColor: Player = i % 2 === 0 ? 'black' : 'white';
        let game = createGame();
        let ply = 0;
        while (!game.winner && ply < 70) {
          const isExpert = game.toMove === expertColor;
          const preset = isExpert ? GOMOKU_AI_STRENGTH_LEVELS[3]! : GOMOKU_AI_STRENGTH_LEVELS[1]!;
          const opts = gomokuLevelToSearchOptions(preset);
          const move = chooseMove(game, {
            ...opts,
            maxTimeMs: isExpert ? 600 : 90,
            maxNodes: isExpert ? opts.maxNodes : 8_000,
          });
          if (!move) break;
          game = applyMove(game, move);
          ply++;
        }
        if (game.winner === expertColor) expertWins++;
      }
      expect(expertWins).toBeGreaterThanOrEqual(Math.floor(rounds * 0.6));
    },
    120_000,
  );
});

describe('gomoku ai search', () => {
  it('iterative deepening reaches reasonable depth on a sparse board', () => {
    const game = applyMove(createGame(), { type: 'place', coord: { x: 7, y: 7 } });
    const { stats } = chooseMoveWithStats(game, {
      maxDepth: 8,
      maxNodes: 200_000,
      maxTimeMs: 2_000,
    });
    expect(stats.depthReached).toBeGreaterThanOrEqual(4);
    expect(stats.nodesVisited).toBeGreaterThan(100);
  });
});
