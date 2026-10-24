import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, beforeAll } from 'vitest';
import init, { BoopGame } from '../../wasm/boop_wasm.js';
import { exportHumanGraduationSetup } from './boop-graduation-fixture';
import { PieceTracker } from './piece-tracker';
import { parseGameView } from './types';

const wasmBytes = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../wasm/boop_wasm_bg.wasm'),
);

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

describe('Boop graduation bookkeeping (wasm)', () => {
  beforeAll(async () => {
    await init(wasmBytes);
  });

  it('removes three kittens, adds three hand cats, and keeps reserve in sync', () => {
    const game = playHumanFirstGraduation(new BoopGame());
    const view = parseGameView(game.view_json());
    expect(view.pools[0]!.kittens_in_hand).toBe(5);
    expect(view.pools[0]!.cats_in_hand).toBe(3);
    expect(view.pools[0]!.cats_in_reserve).toBe(5);
    expect(view.board.flat().filter(Boolean).length).toBe(0);
    expect(view.to_move).toBe('B');
  });

  it('renders only in-hand cats (no reserve pool vases)', () => {
    const game = playHumanFirstGraduation(new BoopGame());
    const view = parseGameView(game.view_json());
    const tracker = new PieceTracker();
    tracker.resetFromNewGame();
    tracker.syncBoard(view);
    const snap = tracker.buildSnapshot(view);
    const handCats = snap.cells
      .flat()
      .filter(p => p.shape === 'cat' && p.player === 'A').length;
    expect(handCats).toBe(view.pools[0]!.cats_in_hand);
    expect(handCats).toBe(3);
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
