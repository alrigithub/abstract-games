import { describe, expect, it } from 'vitest';
import { allPlayableCoords, GameState, moveEquals } from './state';

describe('tzaar rules', () => {
  it('starts with 6 Tzaars, 9 Tzarras, 15 Totts per side', () => {
    const game = new GameState();
    const counts = {
      A: { tzaar: 0, tzarra: 0, tott: 0 },
      B: { tzaar: 0, tzarra: 0, tott: 0 },
    };
    for (const coord of allPlayableCoords()) {
      const stack = game.board.stack(coord);
      expect(stack).toBeTruthy();
      const piece = stack!.top();
      counts[piece.player][piece.kind]++;
    }
    for (const player of ['A', 'B'] as const) {
      expect(counts[player].tzaar).toBe(6);
      expect(counts[player].tzarra).toBe(9);
      expect(counts[player].tott).toBe(15);
    }
  });

  it('starts with white opening captures only', () => {
    const g = new GameState();
    expect(g.toMove).toBe('A');
    expect(g.phase).toBe('WhiteOpening');
    const moves = g.legalMoves();
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(m => m.tag === 'Action')).toBe(true);
  });

  it('applies an opening capture and switches to black forced capture', () => {
    const g = new GameState();
    const move = g.legalMoves()[0]!;
    expect(g.apply(move)).toBe(true);
    expect(g.toMove).toBe('B');
    expect(g.phase).toBe('ForcedCapture');
  });

  it('moveEquals compares actions', () => {
    const a = { tag: 'Action' as const, from: { x: 1, y: 1 }, to: { x: 2, y: 1 } };
    const b = { tag: 'Action' as const, from: { x: 1, y: 1 }, to: { x: 2, y: 1 } };
    expect(moveEquals(a, b)).toBe(true);
  });
});
