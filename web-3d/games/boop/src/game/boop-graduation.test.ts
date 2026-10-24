import { describe, expect, it } from 'vitest';
import './ai';
import { BoopGame } from './engine';
import { exportHumanGraduationSetup } from './boop-graduation-fixture';
import { PieceTracker } from './piece-tracker';
import { parseGameView } from './types';

function apply(game: BoopGame, player: 'A' | 'B', x: number, y: number, piece: 'kitten' | 'cat' = 'kitten') {
  const mv = game.move_for_interaction_json(player, x, y, piece);
  if (!mv) throw new Error(`illegal ${player} (${x},${y}) ${piece}`);
  game.apply_move_json(mv);
}

function playHumanFirstGraduation(game: BoopGame) {
  const staged = BoopGame.import_state(exportHumanGraduationSetup(game));
  apply(staged, 'A', 2, 0);
  return staged;
}

describe('Boop graduation bookkeeping (engine)', () => {
  it('removes three kittens, adds three hand cats, and keeps reserve in sync', () => {
    const game = playHumanFirstGraduation(new BoopGame());
    const view = parseGameView(game.view_json());
    expect(view.pools[0]!.kittens_in_hand).toBe(5);
    expect(view.pools[0]!.cats_in_hand).toBe(3);
    expect(view.pools[0]!.cats_in_reserve).toBe(5);
    expect(view.board.flat().filter(Boolean).length).toBe(0);
    expect(view.to_move).toBe('B');
  });

  it('renders earned hand cats only in the hand column (reserve row stays empty)', () => {
    const game = playHumanFirstGraduation(new BoopGame());
    const view = parseGameView(game.view_json());
    const tracker = new PieceTracker();
    tracker.resetFromNewGame();
    tracker.syncBoard(view);
    const snap = tracker.buildSnapshot(view);
    const handCats = snap.cells.flat().filter(p => p.shape === 'cat' && p.player === 'A');
    expect(handCats.length).toBe(view.pools[0]!.cats_in_hand);
    expect(view.pools[0]!.cats_in_reserve).toBe(5);
    const handCols = new Set<number>();
    snap.cells.forEach((stack, idx) => {
      stack.forEach(p => {
        if (p.player === 'A' && p.shape === 'cat') {
          handCols.add(idx);
        }
      });
    });
    expect(handCols.size).toBeGreaterThan(1);
  });

  it('AI has a legal reply immediately after human graduation', () => {
    const game = playHumanFirstGraduation(new BoopGame());
    const moveJson = game.choose_ai_move(3, 8000, 800);
    expect(moveJson).toBeTruthy();
    const exported = game.export_state();
    const restored = BoopGame.import_state(exported);
    expect(restored.choose_ai_move(3, 8000, 800)).toBeTruthy();
  });
});
