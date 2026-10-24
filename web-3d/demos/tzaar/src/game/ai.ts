import type { GameState, Move } from './state';

export function chooseAiMove(state: GameState): Move | null {
  const moves = state.legalMoves();
  return moves[0] ?? null;
}
