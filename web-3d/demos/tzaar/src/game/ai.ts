import { allPlayableCoords, type GameState, type Move } from './state';

export interface TzaarAiOptions {
  maxDepth?: number;
  maxNodes?: number;
  maxTimeMs?: number;
}

function evaluate(state: GameState): number {
  if (state.winner) return state.winner === state.toMove ? 10_000 : -10_000;
  let score = 0;
  for (const c of allPlayableCoords()) {
    const stack = state.board.stack(c);
    if (!stack) continue;
    const sign = stack.owner === state.toMove ? 1 : -1;
    score += sign * (stack.height + (stack.top().kind === 'tzaar' ? 3 : stack.top().kind === 'tzarra' ? 2 : 1));
  }
  return score + state.legalMoves().length;
}

function apply(state: GameState, move: Move): GameState {
  const next = state.clone();
  if (!next.apply(move)) throw new Error('illegal move');
  return next;
}

export function chooseAiMove(state: GameState, options: TzaarAiOptions = {}): Move | null {
  const moves = state.legalMoves();
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0]!;

  const maxDepth = Math.max(1, Math.min(8, options.maxDepth ?? 3));
  const maxNodes = Math.max(200, Math.min(40_000, options.maxNodes ?? 8_000));
  const deadline = performance.now() + Math.max(100, options.maxTimeMs ?? 1_200);
  let nodes = 0;
  let best = moves[0]!;

  const search = (s: GameState, depth: number, alpha: number, beta: number): number => {
    nodes++;
    if (depth <= 0 || s.winner || nodes >= maxNodes || performance.now() >= deadline) return evaluate(s);
    let value = -Infinity;
    for (const move of s.legalMoves()) {
      const score = -search(apply(s, move), depth - 1, -beta, -alpha);
      value = Math.max(value, score);
      alpha = Math.max(alpha, value);
      if (alpha >= beta || nodes >= maxNodes || performance.now() >= deadline) break;
    }
    return value;
  };

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (performance.now() >= deadline || nodes >= maxNodes) break;
    let iterBest = best;
    let iterScore = -Infinity;
    let complete = true;
    for (const move of moves) {
      if (nodes >= maxNodes || performance.now() >= deadline) {
        complete = false;
        break;
      }
      const score = search(apply(state, move), depth - 1, -Infinity, Infinity);
      if (score > iterScore) {
        iterScore = score;
        iterBest = move;
      }
    }
    if (complete) best = iterBest;
  }
  return best;
}

export function quickLegalMove(state: GameState): Move | null {
  return state.legalMoves()[0] ?? null;
}
