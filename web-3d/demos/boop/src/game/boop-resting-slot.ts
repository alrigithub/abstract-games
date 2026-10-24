import { cellIndex } from '@abstract/three-engine';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';
import { playerRestingColumn, type PoolSlot } from './boop-pool-layout';
import type { PlayerId } from './types';

export interface RestingOccupant {
  row: number;
  col: number;
}

/** Exterior cell one step beyond the bed edge in the boop push direction. */
export function defaultRestingCell(
  from: { x: number; y: number },
  push: { push_x: number; push_y: number },
  player: PlayerId,
): { row: number; col: number } {
  const homeCol = playerRestingColumn(player);
  if (push.push_x !== 0) {
    return { row: from.y, col: homeCol };
  }
  if (push.push_y !== 0) {
    const row = from.y + push.push_y;
    const col = from.x;
    if (isValidRestingCell(row, col)) return { row, col };
  }
  return { row: from.y, col: homeCol };
}

function isValidRestingCell(row: number, col: number): boolean {
  return cellIndex(BOOP_GRID, row, col, BOOP_OUTSIDE) !== null;
}

function isOnPlayableBed(row: number, col: number): boolean {
  return row >= 0 && row < BOOP_GRID && col >= 0 && col < BOOP_GRID;
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

  const maxSteps = BOOP_OUTSIDE * 2 + 2;
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

function columnRowCandidates(player: PlayerId, preferredRow: number): { row: number; col: number }[] {
  const col = playerRestingColumn(player);
  const rows: number[] = [];
  for (let d = 0; d < BOOP_GRID + BOOP_OUTSIDE; d++) {
    if (preferredRow - d >= -BOOP_OUTSIDE) rows.push(preferredRow - d);
    if (d > 0 && preferredRow + d < BOOP_GRID + BOOP_OUTSIDE) rows.push(preferredRow + d);
  }
  return rows.map(row => ({ row, col }));
}

/**
 * Nearest free exterior cell for this owner's off-board tray, never overlapping pool/reserve slots.
 */
export function resolveRestingCell(
  from: { x: number; y: number },
  push: { push_x: number; push_y: number },
  occupants: readonly RestingOccupant[],
  player: PlayerId,
  blocked: readonly PoolSlot[] = [],
): { row: number; col: number } {
  const blockedSet = new Set(blocked.map(c => `${c.row},${c.col}`));
  const taken = (row: number, col: number) =>
    isOccupied(row, col, occupants) || blockedSet.has(`${row},${col}`);

  for (const cell of columnRowCandidates(player, from.y)) {
    if (!taken(cell.row, cell.col)) return cell;
  }

  const start = defaultRestingCell(from, push, player);
  for (const cell of restingCandidates(start, push)) {
    if (!taken(cell.row, cell.col)) return cell;
  }
  return start;
}
