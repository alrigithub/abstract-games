import { describe, expect, it } from 'vitest';
import { applyMove, createGame, winnerFromLastMove } from './engine';

describe('gomoku engine', () => {
  it('detects horizontal five', () => {
    let game = createGame();
    for (let x = 0; x < 5; x++) {
      game = applyMove(game, { type: 'place', coord: { x, y: 7 } });
      if (x < 4) game = applyMove(game, { type: 'place', coord: { x, y: 8 } });
    }
    expect(game.winner).toBe('black');
    expect(winnerFromLastMove(game, { x: 4, y: 7 })).toBe('black');
  });

  it('rejects occupied intersections', () => {
    const game = applyMove(createGame(), { type: 'place', coord: { x: 7, y: 7 } });
    expect(() => applyMove(game, { type: 'place', coord: { x: 7, y: 7 } })).toThrow();
  });
});
