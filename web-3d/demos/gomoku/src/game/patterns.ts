import { BOARD_SIZE, getCell, type Coord, type GameState, type Player } from './engine';

export const SCORE_WIN = 10_000_000;
export const SCORE_OPEN_FOUR = 500_000;
export const SCORE_FOUR = 50_000;
export const SCORE_OPEN_THREE = 8_000;
export const SCORE_BROKEN_THREE = 3_000;
export const SCORE_OPEN_TWO = 400;

const DIRS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

function cellAt(state: GameState, x: number, y: number): Player | 'edge' | null {
  if (!inBounds(x, y)) return 'edge';
  return getCell(state, { x, y });
}

/** Count consecutive `player` stones from (x,y) along (dx,dy), not including (x,y). */
function ray(state: GameState, x: number, y: number, dx: number, dy: number, player: Player): number {
  let n = 0;
  let cx = x + dx;
  let cy = y + dy;
  while (cellAt(state, cx, cy) === player) {
    n++;
    cx += dx;
    cy += dy;
  }
  return n;
}

function emptyAt(state: GameState, x: number, y: number): boolean {
  return cellAt(state, x, y) === null;
}

export interface LineThreat {
  length: number;
  openEnds: number;
}

/** Analyze one line through `coord` after hypothetically placing `player` there. */
export function lineThreatThrough(
  state: GameState,
  coord: Coord,
  player: Player,
  dx: number,
  dy: number,
): LineThreat {
  const fwd = ray(state, coord.x, coord.y, dx, dy, player);
  const back = ray(state, coord.x, coord.y, -dx, -dy, player);
  const length = 1 + fwd + back;
  const fx = coord.x + (fwd + 1) * dx;
  const fy = coord.y + (fwd + 1) * dy;
  const bx = coord.x - (back + 1) * dx;
  const by = coord.y - (back + 1) * dy;
  let openEnds = 0;
  if (emptyAt(state, fx, fy)) openEnds++;
  if (emptyAt(state, bx, by)) openEnds++;
  return { length, openEnds };
}

export function scoreLineThreat(t: LineThreat): number {
  if (t.length >= 5) return SCORE_WIN;
  if (t.length === 4 && t.openEnds === 2) return SCORE_OPEN_FOUR;
  if (t.length === 4 && t.openEnds === 1) return SCORE_FOUR;
  if (t.length === 3 && t.openEnds === 2) return SCORE_OPEN_THREE;
  if (t.length === 3 && t.openEnds === 1) return SCORE_BROKEN_THREE;
  if (t.length === 2 && t.openEnds === 2) return SCORE_OPEN_TWO;
  return 0;
}

/** Best line pattern score for `player` placing at `coord` (without mutating state). */
export function movePatternScore(state: GameState, coord: Coord, player: Player): number {
  let best = 0;
  for (const [dx, dy] of DIRS) {
    const t = lineThreatThrough(state, coord, player, dx, dy);
    best = Math.max(best, scoreLineThreat(t));
  }
  return best;
}

/** Empty cells where `player` would win on the next move. */
export function winningMoves(state: GameState, player: Player): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const c = { x, y };
      if (getCell(state, c) !== null) continue;
      if (movePatternScore(state, c, player) >= SCORE_WIN) out.push(c);
    }
  }
  return out;
}

/** Empty cells where `player` would create an open-four (or win). */
export function openFourMoves(state: GameState, player: Player): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const c = { x, y };
      if (getCell(state, c) !== null) continue;
      const s = movePatternScore(state, c, player);
      if (s >= SCORE_OPEN_FOUR) out.push(c);
    }
  }
  return out;
}

/** Combined attack + defense heuristic for move ordering / leaf eval. */
export function evaluateState(state: GameState, root: Player): number {
  if (state.winner === root) return SCORE_WIN;
  if (state.winner && state.winner !== root) return -SCORE_WIN;

  const us = root;
  const them = root === 'black' ? 'white' : 'black';
  let score = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const c = { x, y };
      const occ = getCell(state, c);
      if (occ === us) {
        for (const [dx, dy] of DIRS) {
          score += scoreLineThreat(lineThreatThrough(state, c, us, dx, dy)) / 4;
        }
      } else if (occ === them) {
        for (const [dx, dy] of DIRS) {
          score -= scoreLineThreat(lineThreatThrough(state, c, them, dx, dy)) / 4;
        }
      }
    }
  }
  const center = Math.floor(BOARD_SIZE / 2);
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const p = getCell(state, { x, y });
      if (!p) continue;
      const d = center - Math.abs(x - center) - Math.abs(y - center);
      score += (p === us ? 1 : -1) * d * 2;
    }
  }
  return state.toMove === us ? score : -score;
}

export function coordKey(c: Coord): string {
  return `${c.x},${c.y}`;
}

export function parseCoordKey(k: string): Coord {
  const [xs, ys] = k.split(',');
  return { x: Number(xs), y: Number(ys) };
}
