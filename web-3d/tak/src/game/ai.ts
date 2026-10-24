import { applyMove, flatCounts, legalMoves, opposite, step, type GameState, type Move } from './engine';
import type { Color } from '../types';

export interface AiOptions { maxDepth?: number; maxNodes?: number; maxTimeMs?: number }
/** Deterministic, bounded alpha-beta search. A node budget makes repeated results reproducible. */
export function chooseMove(game: GameState, options: AiOptions = {}): Move | null {
  const maxNodes = Math.max(1, Math.min(100000, options.maxNodes ?? 5000));
  const maxDepth = Math.max(1, Math.min(12, options.maxDepth ?? 2));
  const deadline = performance.now() + Math.max(100, options.maxTimeMs ?? 60_000);
  const root = game.toMove;
  let nodes = 0;
  const timedOut = () => performance.now() >= deadline;
  const evaluate = (state: GameState): number => {
    if (state.result) return state.result.winner === null ? 0 : state.result.winner === root ? 1000000 : -1000000;
    const flats = flatCounts(state.board);
    let score = (flats[root] - flats[opposite(root)]) * 10;
    for (let i = 0; i < state.board.size ** 2; i++) {
      const stack = state.board.cells[i]!, top = stack.at(-1); if (!top) continue;
      const sign = top.color === root ? 1 : -1;
      score += sign * (stack.length + (top.kind === 'capstone' ? 6 : 0));
      if (top.orientation === 'standing') continue;
      for (const direction of ['east', 'south'] as const) {
        const next = step(state.board.size, i, direction), neighbor = next === null ? undefined : state.board.cells[next]!.at(-1);
        if (neighbor?.color === top.color && neighbor.orientation === 'flat') score += sign * 5;
      }
    }
    return score;
  };
  const ordered = (state: GameState) => legalMoves(state).map((move, index) => {
    const child = applyMove(state, move);
    return { move, child, index, score: evaluate(child) };
  }).sort((a, b) => (state.toMove === root ? b.score - a.score : a.score - b.score) || a.index - b.index);
  const search = (state: GameState, depth: number, alpha: number, beta: number): number => {
    nodes++;
    if (!depth || state.result || nodes >= maxNodes || timedOut()) return evaluate(state);
    const maximizing = state.toMove === root;
    let value = maximizing ? -Infinity : Infinity;
    for (const { child } of ordered(state)) {
      const score = search(child, depth - 1, alpha, beta);
      value = maximizing ? Math.max(value, score) : Math.min(value, score);
      if (maximizing) alpha = Math.max(alpha, value); else beta = Math.min(beta, value);
      if (beta <= alpha || nodes >= maxNodes || timedOut()) break;
    }
    return Number.isFinite(value) ? value : evaluate(state);
  };
  const candidates = ordered(game);
  if (!candidates.length) return null;
  let best = candidates[0]!.move;
  // Always recognize a direct win before spending work on deeper branches.
  const win = candidates.find(candidate => candidate.child.result?.winner === root);
  if (win) return win.move;
  for (let depth = 1; depth <= maxDepth && nodes < maxNodes && !timedOut(); depth++) {
    let value = -Infinity, iterationBest = best, complete = true;
    for (const candidate of candidates) {
      if (nodes >= maxNodes || timedOut()) { complete = false; break; }
      const score = search(candidate.child, depth - 1, value, Infinity);
      if (score > value) { value = score; iterationBest = candidate.move; }
    }
    if (complete) best = iterationBest;
  }
  return best;
}
