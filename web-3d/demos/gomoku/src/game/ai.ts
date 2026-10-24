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

export interface AiOptions {
  maxDepth?: number;
  maxNodes?: number;
  maxTimeMs?: number;
}

const EVAL_MAX = 1_000_000;

function centerPriority(coord: Coord): number {
  const center = Math.floor(BOARD_SIZE / 2);
  return -Math.abs(coord.x - center) - Math.abs(coord.y - center);
}

function orderedMoves(state: GameState): Move[] {
  return legalMoves(state).sort((a, b) => centerPriority(b.coord) - centerPriority(a.coord));
}

function step(coord: Coord, dx: number, dy: number): Coord | null {
  const x = coord.x + dx;
  const y = coord.y + dy;
  if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return null;
  return { x, y };
}

function playerStones(state: GameState, player: Player): number {
  return state.cells.filter(c => c === player).length;
}

function threatCounts(state: GameState, player: Player) {
  const counts = { openTwo: 0, openThree: 0, openFour: 0 };
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const start = { x, y };
      if (getCell(state, start) !== player) continue;
      for (const [dx, dy] of dirs) {
        const prev = step(start, -dx, -dy);
        if (prev && getCell(state, prev) === player) continue;
        let length = 0;
        let cur: Coord | null = start;
        while (cur && getCell(state, cur) === player) {
          length++;
          cur = step(cur, dx, dy);
        }
        const beforeOpen = !prev || getCell(state, prev) === null;
        const afterOpen = cur !== null && getCell(state, cur) === null;
        const openEnds = (beforeOpen ? 1 : 0) + (afterOpen ? 1 : 0);
        if (length === 2 && openEnds === 2) counts.openTwo++;
        else if (length === 3 && openEnds === 2) counts.openThree++;
        else if (length === 4 && openEnds === 2) counts.openFour++;
        else if (length === 3 && openEnds === 1) counts.openThree++;
        else if (length === 4 && openEnds === 1) counts.openFour++;
      }
    }
  }
  return counts;
}

function centerScore(state: GameState, player: Player): number {
  const center = Math.floor(BOARD_SIZE / 2);
  let score = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (state.cells[y * BOARD_SIZE + x] === player) {
        score += center - Math.abs(x - center) - Math.abs(y - center);
      }
    }
  }
  return score;
}

function evaluate(state: GameState, root: Player): number {
  if (state.winner === root) return EVAL_MAX;
  if (state.winner && state.winner !== root) return -EVAL_MAX;
  const material = playerStones(state, 'black') - playerStones(state, 'white');
  const blackThreats = threatCounts(state, 'black');
  const whiteThreats = threatCounts(state, 'white');
  const threat =
    50 * (blackThreats.openTwo - whiteThreats.openTwo) +
    500 * (blackThreats.openThree - whiteThreats.openThree) +
    5000 * (blackThreats.openFour - whiteThreats.openFour);
  const center = centerScore(state, 'black') - centerScore(state, 'white');
  let score = 10 * material + threat + 3 * center;
  if (state.toMove === 'white') score = -score;
  return root === 'black' ? score : -score;
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
): number {
  nodes.n++;
  if (depth === 0 || state.winner || nodes.n >= maxNodes || performance.now() >= deadline) return evaluate(state, root);
  let best = -Infinity;
  for (const move of orderedMoves(state)) {
    const child = applyMove(state, move);
    const score = -negamax(child, depth - 1, -beta, -alpha, root, nodes, maxNodes, deadline);
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta || nodes.n >= maxNodes || performance.now() >= deadline) break;
  }
  return best;
}

export function chooseMove(state: GameState, options: AiOptions = {}): Move | null {
  const maxDepth = Math.max(1, Math.min(12, options.maxDepth ?? 4));
  const maxNodes = Math.max(500, Math.min(80_000, options.maxNodes ?? 12_000));
  const deadline = performance.now() + Math.max(100, options.maxTimeMs ?? 60_000);
  const moves = orderedMoves(state);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0]!;
  const root = state.toMove;
  for (const move of moves) {
    const child = applyMove(state, move);
    if (child.winner === root) return move;
  }
  let bestMove = moves[0]!;
  let bestScore = -Infinity;
  const nodes = { n: 0 };
  for (const move of moves) {
    const child = applyMove(state, move);
    const score = -negamax(child, maxDepth - 1, -Infinity, Infinity, root, nodes, maxNodes, deadline);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (nodes.n >= maxNodes || performance.now() >= deadline) break;
  }
  return bestMove;
}
