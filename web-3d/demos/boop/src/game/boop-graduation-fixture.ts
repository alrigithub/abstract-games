import type { BoopGame } from '../../wasm/boop_wasm.js';

/** Two white kittens on row 0 plus pool counts matching rules::graduate_three_kittens. */
export function exportHumanGraduationSetup(base: BoopGame): string {
  const state = JSON.parse(base.export_state()) as {
    board: ({ player: string; kind: string } | null)[][];
    pools: { kittens_in_hand: number; cats_in_hand: number; cats_in_reserve: number }[];
    to_move: string;
    winner: string | null;
    pending_graduation: unknown[];
  };
  state.board[0]![0] = { player: 'A', kind: 'kitten' };
  state.board[0]![1] = { player: 'A', kind: 'kitten' };
  state.pools[0]!.kittens_in_hand = 6;
  state.to_move = 'A';
  state.winner = null;
  state.pending_graduation = [];
  return JSON.stringify(state);
}
