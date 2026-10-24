import { cloneGameState } from './clone';
import { possibleMoves } from './moves';
import type { GameState, Move } from './state';

function evaluate(state: GameState): number {
  const win = state.winner();
  if (win === 'A') return 10_000;
  if (win === 'B') return -10_000;
  const score = (state.pointsA - state.pointsB) * 200;
  const mobility = possibleMoves(state).length;
  const side = state.activePlayer === 'A' ? 1 : -1;
  return score + side * mobility;
}

function apply(state: GameState, move: Move): GameState {
  const next = cloneGameState(state);
  next.performMove(move);
  return next;
}

function negamax(state: GameState, depth: number, alpha: number, beta: number): number {
  const win = state.winner();
  if (win || depth <= 0) return evaluate(state);

  let best = -Infinity;
  for (const move of possibleMoves(state)) {
    const score = -negamax(apply(state, move), depth - 1, -beta, -alpha);
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseAiMove(state: GameState, maxDepth: number): Move {
  const all = possibleMoves(state);
  const moves = all.filter(m => m.tag !== 'Wait');
  const pool = moves.length ? moves : all;
  if (pool.length === 0) throw new Error('no legal moves');
  if (pool.length === 1) return pool[0]!;

  let bestMove = pool[0]!;
  let bestScore = -Infinity;
  for (const move of pool) {
    const score = -negamax(apply(state, move), maxDepth - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}
