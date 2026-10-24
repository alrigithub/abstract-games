import {
  BOARD_SIZE,
  GameState,
  bindChooseAiMove,
  moveCoord,
  type Coord,
  type Move,
  type Player,
  type TurnMode,
} from './engine';

export interface SearchLimits {
  maxDepth: number;
  maxNodes: number;
  timeBudgetMs: number;
}

const EVAL_MIN = -1_000_000_000;
const EVAL_MAX = 1_000_000_000;

type WinnerKind = 'player_to_move' | 'player_just_moved';

function getWinner(state: GameState): WinnerKind | null {
  if (state.winner === null) return null;
  return state.winner === state.toMove ? 'player_to_move' : 'player_just_moved';
}

function winnerEvaluate(kind: WinnerKind): number {
  return kind === 'player_to_move' ? EVAL_MAX / 2 : EVAL_MIN / 2;
}

function centerPriority(coord: { x: number; y: number }): number {
  const center = BOARD_SIZE / 2 - 0.5;
  return -Math.abs(coord.x - center) - Math.abs(coord.y - center);
}

function orderedMoves(state: GameState): Move[] {
  const moves = state.legalMoves();
  return moves.slice().sort((a, b) => centerPriority(moveCoord(a)) - centerPriority(moveCoord(b))).reverse();
}

export function greedyGraduationChoice(state: GameState): [Coord, Coord, Coord] | null {
  const tm: TurnMode = state.turnMode();
  if (tm.kind !== 'choose_graduation') return null;
  let best: (typeof tm.lines)[number] | null = null;
  let bestScore = -1;
  for (const line of tm.lines) {
    const kittens = line.filter(c => state.boardGet(c)?.kind === 'kitten').length;
    if (kittens > bestScore) {
      bestScore = kittens;
      best = line;
    }
  }
  return best;
}

function applyForSearch(state: GameState, m: Move): GameState | null {
  const next = state.clone();
  try {
    next.apply(m);
  } catch {
    return null;
  }
  const line = greedyGraduationChoice(next);
  if (line) {
    try {
      next.apply({ type: 'graduate', line });
    } catch {
      return null;
    }
  }
  return next;
}

interface Heuristic {
  evaluateForFirst(state: GameState): number;
}

class SimpleHeuristic implements Heuristic {
  readonly fKitten = 20;
  readonly fCat = 120;
  readonly fCatInHand = 80;
  readonly fCenter = 4;

  evaluateForFirst(state: GameState): number {
    const first = material(state, 'A');
    const second = material(state, 'B');
    return (
      this.fKitten * (first.kittens - second.kittens) +
      this.fCat * (first.cats - second.cats) +
      this.fCatInHand * (first.catsInHand - second.catsInHand) +
      this.fCenter * (first.center - second.center)
    );
  }
}

function material(state: GameState, player: Player) {
  const pool = state.pool(player);
  const center = BOARD_SIZE / 2 - 0.5;
  let kittens = 0;
  let cats = 0;
  let centerScore = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const piece = state.boardGet({ x, y });
      if (!piece || piece.player !== player) continue;
      centerScore += center - (Math.abs(x - center) + Math.abs(y - center));
      if (piece.kind === 'kitten') kittens++;
      else cats++;
    }
  }
  return { kittens, cats, catsInHand: pool.cats_in_hand, center: centerScore };
}

function evaluateState(heuristic: Heuristic, state: GameState): number {
  if (state.winner === 'A') return EVAL_MAX / 2;
  if (state.winner === 'B') return EVAL_MIN / 2;
  const score = heuristic.evaluateForFirst(state);
  return state.toMove === 'A' ? score : -score;
}

interface SearchCtx {
  heuristic: Heuristic;
  deadline: number;
  maxNodes: number;
  nodes: number;
}

function timedOut(ctx: SearchCtx): boolean {
  return performance.now() >= ctx.deadline || ctx.nodes >= ctx.maxNodes;
}

function evaluateTerminal(ctx: SearchCtx, state: GameState): number {
  const w = getWinner(state);
  if (w) return winnerEvaluate(w);
  return evaluateState(ctx.heuristic, state);
}

function negamax(ctx: SearchCtx, state: GameState, depth: number, alpha: number, beta: number): number {
  ctx.nodes++;
  if (timedOut(ctx)) return evaluateTerminal(ctx, state);
  const w = getWinner(state);
  if (w) return winnerEvaluate(w);
  if (depth === 0) return evaluateState(ctx.heuristic, state);

  const moves = orderedMoves(state);
  if (moves.length === 0) return evaluateState(ctx.heuristic, state);

  let best = EVAL_MIN / 2;
  for (const m of moves) {
    if (timedOut(ctx)) break;
    const child = applyForSearch(state, m);
    if (!child) continue;
    const value = -negamax(ctx, child, depth - 1, -beta, -alpha);
    if (value > best) best = value;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseMoveLimited(state: GameState, limits: SearchLimits): Move | null {
  const legal = state.legalMoves();
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0]!;

  const maxDepth = Math.max(1, Math.min(10, limits.maxDepth));
  const maxNodes = Math.max(1, limits.maxNodes);
  const budgetMs = Math.max(50, Math.min(120_000, limits.timeBudgetMs));
  const deadline = performance.now() + budgetMs;

  const ctx: SearchCtx = {
    heuristic: new SimpleHeuristic(),
    deadline,
    maxNodes,
    nodes: 0,
  };

  let best = legal[0]!;
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (timedOut(ctx)) break;
    const moves = orderedMoves(state);
    if (moves.length === 0) break;

    let iterationBest = best;
    let alpha = EVAL_MIN / 2;
    const beta = EVAL_MAX / 2;
    let complete = true;

    for (const m of moves) {
      if (timedOut(ctx)) {
        complete = false;
        break;
      }
      const child = applyForSearch(state, m);
      if (!child) continue;
      const score = -negamax(ctx, child, depth - 1, -beta, -alpha);
      if (score > alpha) {
        alpha = score;
        iterationBest = m;
      }
    }
    if (complete) best = iterationBest;
  }

  return best;
}

export function chooseMove(
  state: GameState,
  maxDepth: number,
  maxNodes: number,
  timeBudgetMs: number,
): Move | null {
  return chooseMoveLimited(state, { maxDepth, maxNodes, timeBudgetMs });
}

bindChooseAiMove((state, maxDepth, maxNodes, timeBudgetMs) =>
  chooseMove(state, maxDepth, maxNodes, timeBudgetMs),
);
