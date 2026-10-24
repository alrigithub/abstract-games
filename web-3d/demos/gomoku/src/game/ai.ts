import {
  BOARD_SIZE,
  applyMove,
  getCell,
  legalMoves,
  type Coord,
  type GameState,
  type Move,
  type Player,
} from './engine';
import {
  SCORE_OPEN_FOUR,
  SCORE_WIN,
  coordKey,
  evaluateState,
  movePatternScore,
  openFourMoves,
  parseCoordKey,
  winningMoves,
} from './patterns';

export interface AiOptions {
  maxDepth?: number;
  maxNodes?: number;
  maxTimeMs?: number;
  /** When true (Expert default), try a short VCF threat search before alpha-beta. */
  useVcf?: boolean;
}

export interface AiSearchStats {
  depthReached: number;
  nodesVisited: number;
  elapsedMs: number;
  usedVcf: boolean;
}

export const GOMOKU_AI_STRENGTH_LEVELS = [
  { id: 'easy', label: 'Easy', maxDepth: 2, maxNodes: 3_000, timeBudgetMs: 350 },
  { id: 'medium', label: 'Medium', maxDepth: 4, maxNodes: 15_000, timeBudgetMs: 900 },
  { id: 'hard', label: 'Hard', maxDepth: 6, maxNodes: 80_000, timeBudgetMs: 2_000 },
  { id: 'expert', label: 'Expert', maxDepth: 12, maxNodes: 2_000_000, timeBudgetMs: 4_500 },
] as const;

const TT_MAX = 120_000;

type TtFlag = 'exact' | 'lower' | 'upper';

interface TtEntry {
  depth: number;
  score: number;
  flag: TtFlag;
  best?: string;
}

const zobrist: number[][][] = [];
const zobristSide: number[] = [];

(function initZobrist() {
  for (let y = 0; y < BOARD_SIZE; y++) {
    zobrist[y] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      zobrist[y]![x] = [randU32(), randU32()];
    }
  }
  zobristSide[0] = randU32();
  zobristSide[1] = randU32();
})();

function randU32(): number {
  return (Math.random() * 0x1_0000_0000) >>> 0;
}

function hashState(state: GameState): number {
  let h = state.toMove === 'black' ? zobristSide[0]! : zobristSide[1]!;
  for (let i = 0; i < state.cells.length; i++) {
    const p = state.cells[i];
    if (!p) continue;
    const x = i % BOARD_SIZE;
    const y = Math.floor(i / BOARD_SIZE);
    h ^= zobrist[y]![x]![p === 'black' ? 0 : 1]!;
  }
  return h >>> 0;
}

function centerPriority(coord: Coord): number {
  const center = Math.floor(BOARD_SIZE / 2);
  return -Math.abs(coord.x - center) - Math.abs(coord.y - center);
}

function hasStones(state: GameState): boolean {
  return state.cells.some(c => c !== null);
}

/** Candidate intersections: empty cells near existing stones (or center on empty board). */
export function candidateCoords(state: GameState): Coord[] {
  if (!hasStones(state)) {
    const c = Math.floor(BOARD_SIZE / 2);
    return [{ x: c, y: c }];
  }
  const out: Coord[] = [];
  const seen = new Set<string>();
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (state.cells[y * BOARD_SIZE + x] === null) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) continue;
          if (state.cells[ny * BOARD_SIZE + nx] !== null) continue;
          const key = coordKey({ x: nx, y: ny });
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ x: nx, y: ny });
        }
      }
    }
  }
  return out.length ? out : legalMoves(state).map(m => m.coord);
}

function moveOrderScore(state: GameState, coord: Coord, player: Player): number {
  const opp = player === 'black' ? 'white' : 'black';
  const attack = movePatternScore(state, coord, player);
  const defend = movePatternScore(state, coord, opp);
  return Math.max(attack, defend) * 2 + attack + defend + centerPriority(coord);
}

function orderedCandidateMoves(state: GameState): Move[] {
  const player = state.toMove;
  const coords = candidateCoords(state);
  return coords
    .map(coord => ({ type: 'place' as const, coord }))
    .sort((a, b) => moveOrderScore(state, b.coord, player) - moveOrderScore(state, a.coord, player));
}

function pickTacticalMove(state: GameState): Move | null {
  const us = state.toMove;
  const them = us === 'black' ? 'white' : 'black';
  const moves = orderedCandidateMoves(state);
  if (!moves.length) return null;

  const ourWin = winningMoves(state, us);
  if (ourWin.length) return { type: 'place', coord: ourWin[0]! };

  const oppWin = winningMoves(state, them);
  if (oppWin.length === 1) return { type: 'place', coord: oppWin[0]! };
  if (oppWin.length > 1) {
    let best: Move | null = null;
    let bestScore = -Infinity;
    for (const m of moves) {
      if (!oppWin.some(c => c.x === m.coord.x && c.y === m.coord.y)) continue;
      const s = movePatternScore(state, m.coord, us);
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    if (best) return best;
  }

  const ourFour = openFourMoves(state, us);
  if (ourFour.length) return { type: 'place', coord: ourFour[0]! };

  const oppFour = openFourMoves(state, them);
  if (oppFour.length === 1) return { type: 'place', coord: oppFour[0]! };
  if (oppFour.length > 1) {
    for (const m of moves) {
      if (oppFour.some(c => c.x === m.coord.x && c.y === m.coord.y)) return m;
    }
  }

  return null;
}

function tryVcfMove(state: GameState, deadline: number, maxPly: number): Coord | null {
  const us = state.toMove;

  function dfs(s: GameState, plyLeft: number): boolean {
    if (performance.now() >= deadline || plyLeft <= 0) return false;
    const wins = winningMoves(s, us);
    if (wins.length) return true;

    const fours = openFourMoves(s, us);
    const candidates = [...new Map([...wins, ...fours].map(c => [coordKey(c), c])).values()];
    if (!candidates.length) return false;

    for (const c of candidates) {
      const child = applyMove(s, { type: 'place', coord: c });
      if (child.winner === us) return true;
      const finish = winningMoves(child, us);
      if (finish.length >= 2) return true;
      if (finish.length === 0) continue;
      let allWin = true;
      for (const block of finish) {
        if (getCell(child, block) !== null) {
          allWin = false;
          break;
        }
        const afterBlock = applyMove(child, { type: 'place', coord: block });
        if (!dfs(afterBlock, plyLeft - 1)) {
          allWin = false;
          break;
        }
      }
      if (allWin) return true;
    }
    return false;
  }

  const wins = winningMoves(state, us);
  if (wins.length) return wins[0]!;
  const fours = openFourMoves(state, us);
  const roots = [...new Map([...wins, ...fours].map(c => [coordKey(c), c])).values()];
  for (const c of roots) {
    const child = applyMove(state, { type: 'place', coord: c });
    if (child.winner === us) return c;
    const finish = winningMoves(child, us);
    if (finish.length >= 2) return c;
    if (finish.length === 0) continue;
    let allWin = true;
    for (const block of finish) {
      const afterBlock = applyMove(child, { type: 'place', coord: block });
      if (!dfs(afterBlock, maxPly - 1)) {
        allWin = false;
        break;
      }
    }
    if (allWin) return c;
  }
  return null;
}

function negamax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  root: Player,
  nodes: { n: number },
  maxNodes: number,
  deadline: number,
  tt: Map<number, TtEntry>,
  ply: number,
): number {
  nodes.n++;
  if (nodes.n >= maxNodes || performance.now() >= deadline) return evaluateState(state, root);

  const h = hashState(state);
  const ttHit = tt.get(h);
  if (ttHit && ttHit.depth >= depth) {
    if (ttHit.flag === 'exact') return ttHit.score;
    if (ttHit.flag === 'lower') alpha = Math.max(alpha, ttHit.score);
    else beta = Math.min(beta, ttHit.score);
    if (alpha >= beta) return ttHit.score;
  }

  if (depth === 0 || state.winner) {
    const ev = evaluateState(state, root);
    return ev;
  }

  let best = -Infinity;
  let bestKey: string | undefined;
  const moves = orderedCandidateMoves(state);
  if (ttHit?.best) {
    const bk = ttHit.best;
    moves.sort((a, b) => {
      const aw = coordKey(a.coord) === bk ? 1 : 0;
      const bw = coordKey(b.coord) === bk ? 1 : 0;
      return bw - aw;
    });
  }

  let flag: TtFlag = 'upper';
  for (const move of moves) {
    const child = applyMove(state, move);
    const score = -negamax(child, depth - 1, -beta, -alpha, root, nodes, maxNodes, deadline, tt, ply + 1);
    if (score > best) {
      best = score;
      bestKey = coordKey(move.coord);
    }
    alpha = Math.max(alpha, score);
    if (alpha >= beta) {
      flag = 'lower';
      break;
    }
    if (nodes.n >= maxNodes || performance.now() >= deadline) break;
  }
  if (best <= alpha) flag = 'upper';
  else if (best >= beta) flag = 'lower';
  else flag = 'exact';

  if (tt.size > TT_MAX) tt.clear();
  tt.set(h, { depth, score: best, flag, best: bestKey });

  return best;
}

export function chooseMoveWithStats(state: GameState, options: AiOptions = {}): { move: Move | null; stats: AiSearchStats } {
  const maxDepth = Math.max(1, Math.min(16, options.maxDepth ?? 4));
  const maxNodes = Math.max(500, Math.min(5_000_000, options.maxNodes ?? 12_000));
  const deadline = performance.now() + Math.max(100, options.maxTimeMs ?? 60_000);
  const useVcf = options.useVcf ?? maxDepth >= 7;

  const tactical = pickTacticalMove(state);
  if (tactical) {
    return {
      move: tactical,
      stats: { depthReached: 0, nodesVisited: 0, elapsedMs: 0, usedVcf: false },
    };
  }

  const start = performance.now();
  let usedVcf = false;
  if (useVcf && performance.now() < deadline) {
    const vcf = tryVcfMove(state, deadline, 10);
    if (vcf) {
      usedVcf = true;
      return {
        move: { type: 'place', coord: vcf },
        stats: {
          depthReached: 0,
          nodesVisited: 0,
          elapsedMs: performance.now() - start,
          usedVcf: true,
        },
      };
    }
  }

  const moves = orderedCandidateMoves(state);
  if (!moves.length) return { move: null, stats: { depthReached: 0, nodesVisited: 0, elapsedMs: 0, usedVcf } };
  if (moves.length === 1) {
    return { move: moves[0]!, stats: { depthReached: 1, nodesVisited: 1, elapsedMs: performance.now() - start, usedVcf } };
  }

  const root = state.toMove;
  const tt = new Map<number, TtEntry>();
  let bestMove = moves[0]!;
  let depthReached = 0;
  const nodes = { n: 0 };

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (performance.now() >= deadline) break;
    let iterBest = bestMove;
    let iterScore = -Infinity;
    for (const move of moves) {
      const child = applyMove(state, move);
      const score = -negamax(
        child,
        depth - 1,
        -Infinity,
        Infinity,
        root,
        nodes,
        maxNodes,
        deadline,
        tt,
        1,
      );
      if (score > iterScore) {
        iterScore = score;
        iterBest = move;
      }
      if (nodes.n >= maxNodes || performance.now() >= deadline) break;
    }
    bestMove = iterBest;
    depthReached = depth;
    moves.sort((a, b) => {
      const aw = coordKey(a.coord) === coordKey(iterBest.coord) ? 1 : 0;
      const bw = coordKey(b.coord) === coordKey(iterBest.coord) ? 1 : 0;
      return bw - aw;
    });
    if (Math.abs(iterScore) >= SCORE_WIN - 1000) break;
    if (nodes.n >= maxNodes || performance.now() >= deadline) break;
  }

  return {
    move: bestMove,
    stats: {
      depthReached,
      nodesVisited: nodes.n,
      elapsedMs: performance.now() - start,
      usedVcf,
    },
  };
}

export function chooseMove(state: GameState, options: AiOptions = {}): Move | null {
  return chooseMoveWithStats(state, options).move;
}

/** Map stored strength preset to worker search options (Expert enables VCF). */
export function gomokuLevelToSearchOptions(level: { maxDepth: number; maxNodes: number; timeBudgetMs: number }): {
  maxDepth: number;
  maxNodes: number;
  maxTimeMs: number;
  useVcf?: boolean;
} {
  return {
    maxDepth: level.maxDepth,
    maxNodes: level.maxNodes,
    maxTimeMs: level.timeBudgetMs,
    useVcf: level.maxDepth >= 7,
  };
}

export { parseCoordKey, SCORE_OPEN_FOUR, SCORE_WIN };
