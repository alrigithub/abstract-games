import type { BoopGame } from './engine';

/** Black kittens at (1,0) and (0,1); white to place at (0,0) — two simultaneous boop pushes. */
export function exportDualAdjacentBoopSetup(base: BoopGame): string {
  const state = JSON.parse(base.export_state()) as {
    board: ({ player: string; kind: string } | null)[][];
    pools: { kittens_in_hand: number; cats_in_hand: number; cats_in_reserve: number }[];
    to_move: string;
    winner: string | null;
    pending_graduation: unknown[];
  };
  state.board[0]![1] = { player: 'B', kind: 'kitten' };
  state.board[1]![0] = { player: 'B', kind: 'kitten' };
  state.pools[0]!.kittens_in_hand = 8;
  state.to_move = 'A';
  state.winner = null;
  state.pending_graduation = [];
  return JSON.stringify(state);
}
