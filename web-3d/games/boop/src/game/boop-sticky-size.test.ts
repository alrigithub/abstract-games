import { describe, expect, it, vi } from 'vitest';
import { BoopController } from './controller';
import type { SceneApi } from '@abstract/three-engine';

vi.mock('./ai', () => ({}));

vi.mock('./engine', () => ({
  bindChooseAiMove: vi.fn(),
  BoopGame: class {
    view_json() {
      return JSON.stringify({
        board: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => null)),
        pools: [
          { kittens_in_hand: 0, cats_in_hand: 2, kittens_on_bed: 0, cats_on_bed: 0 },
          { kittens_in_hand: 8, cats_in_hand: 8, kittens_on_bed: 0, cats_on_bed: 0 },
        ],
        to_move: 'A',
        winner: null,
        turn_mode: { kind: 'place' },
        effects: { line_highlight: null, displacements: [], off_board: [], graduated_cells: null },
      });
    }
    move_for_interaction_json() {
      return undefined;
    }
    apply_move_json() {}
    choose_ai_move() {
      return null;
    }
  },
}));

describe('BoopController sticky size', () => {
  it('falls back to available hand stock when sticky kind is empty', async () => {
    const scene = { setSnapshot: vi.fn(), enqueueAnimation: (fn: () => Promise<void>) => fn() } as unknown as SceneApi;
    const controller = new BoopController({
      scene,
      setStatus: vi.fn(),
      getAiSearchOptions: () => ({ maxDepth: 2, maxNodes: 4_000, maxTimeMs: 400 }),
    });
    await controller.init();
    controller.setStickyKind('kitten');
    expect(controller.effectiveStickyKind()).toBe('cat');
  });
});
