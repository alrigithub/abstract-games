import { cloneGameState } from './clone';
import { possibleMoves } from './moves';
import type { GameState, Move } from './state';

export interface YinshAiOptions {
  maxDepth?: number;
  maxNodes?: number;
  maxTimeMs?: number;
}

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

function movePool(state: GameState): Move[] {
  const all = possibleMoves(state);
  const moves = all.filter(m => m.tag !== 'Wait');
  return moves.length ? moves : all;
}

function negamax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  nodes: { n: number },
  maxNodes: number,
  deadline: number,
): number {
  nodes.n++;
  const win = state.winner();
  if (win || depth <= 0 || nodes.n >= maxNodes || performance.now() >= deadline) return evaluate(state);

  let best = -Infinity;
  for (const move of possibleMoves(state)) {
    const score = -negamax(apply(state, move), depth - 1, -beta, -alpha, nodes, maxNodes, deadline);
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta || nodes.n >= maxNodes || performance.now() >= deadline) break;
  }
  return best;
}

export function chooseAiMove(state: GameState, options: YinshAiOptions = {}): Move | null {
  const maxDepth = Math.max(1, Math.min(10, options.maxDepth ?? 4));
  const maxNodes = Math.max(500, Math.min(80_000, options.maxNodes ?? 12_000));
  const deadline = performance.now() + Math.max(100, options.maxTimeMs ?? 3_000);
  const pool = movePool(state);
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0]!;

  let bestMove = pool[0]!;
  const nodes = { n: 0 };

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (performance.now() >= deadline || nodes.n >= maxNodes) break;
    let depthBest = bestMove;
    let depthScore = -Infinity;
    let completed = true;
    for (const move of pool) {
      if (nodes.n >= maxNodes || performance.now() >= deadline) {
        completed = false;
        break;
      }
      const score = -negamax(apply(state, move), depth - 1, -Infinity, Infinity, nodes, maxNodes, deadline);
      if (score > depthScore) {
        depthScore = score;
        depthBest = move;
      }
    }
    if (completed) bestMove = depthBest;
  }
  return bestMove;
}

/** Fast legal move when search fails (main thread or worker). */
export function quickLegalMove(state: GameState): Move | null {
  return movePool(state)[0] ?? null;
}
