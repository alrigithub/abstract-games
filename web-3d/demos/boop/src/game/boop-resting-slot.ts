import { cellIndex } from '@abstract/three-engine';

const GRID = 6;
const OUTSIDE = 2;

export interface RestingOccupant {
  row: number;
  col: number;
}

/** Exterior cell one step beyond the bed edge in the boop push direction. */
export function defaultRestingCell(
  from: { x: number; y: number },
  push: { push_x: number; push_y: number },
): { row: number; col: number } {
  return { row: from.y + push.push_y, col: from.x + push.push_x };
}

function isValidRestingCell(row: number, col: number): boolean {
  return cellIndex(GRID, row, col, OUTSIDE) !== null;
}

function isOnPlayableBed(row: number, col: number): boolean {
  return row >= 0 && row < GRID && col >= 0 && col < GRID;
}

function isOccupied(row: number, col: number, occupants: readonly RestingOccupant[]): boolean {
  return occupants.some(o => o.row === row && o.col === col);
}

function pushStep(push: { push_x: number; push_y: number }): { dRow: number; dCol: number } {
  const dRow = push.push_y === 0 ? 0 : Math.sign(push.push_y);
  const dCol = push.push_x === 0 ? 0 : Math.sign(push.push_x);
  return { dRow, dCol };
}

/** Candidate resting cells on the same off-board line, outward first then inward. */
function restingCandidates(
  start: { row: number; col: number },
  push: { push_x: number; push_y: number },
): { row: number; col: number }[] {
  const { dRow, dCol } = pushStep(push);
  const out: { row: number; col: number }[] = [];
  const seen = new Set<string>();
  const add = (row: number, col: number) => {
    const key = `${row},${col}`;
    if (seen.has(key) || !isValidRestingCell(row, col) || isOnPlayableBed(row, col)) return;
    seen.add(key);
    out.push({ row, col });
  };

  const maxSteps = OUTSIDE * 2 + 2;
  let row = start.row;
  let col = start.col;
  for (let i = 0; i < maxSteps; i++) {
    add(row, col);
    const nextRow = row + dRow;
    const nextCol = col + dCol;
    if (!isValidRestingCell(nextRow, nextCol) || isOnPlayableBed(nextRow, nextCol)) break;
    row = nextRow;
    col = nextCol;
  }

  return out;
}

/**
 * Nearest free exterior cell along the same off-board line, stepping outward in the push
 * direction first (deterministic).
 */
export function resolveRestingCell(
  from: { x: number; y: number },
  push: { push_x: number; push_y: number },
  occupants: readonly RestingOccupant[],
): { row: number; col: number } {
  const start = defaultRestingCell(from, push);
  for (const cell of restingCandidates(start, push)) {
    if (!isOccupied(cell.row, cell.col, occupants)) return cell;
  }
  return start;
}
