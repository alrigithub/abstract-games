import { cellIndex } from '@abstract/three-engine';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';
import type { PieceKind, PlayerId } from './types';

export type PoolSlot = { row: number; col: number };

export type PoolColumn = 'kitten' | 'cat_hand' | 'cat_reserve';

/** Side rows for pool pieces (avoid row −1 above the bed — it floated big vases off-screen). */
const POOL_ROWS: number[] = [0, 1, 2, 3, 4, 5, 6, 7];

function sideCols(player: PlayerId): Record<PoolColumn, number> {
  return player === 'A'
    ? { kitten: -4, cat_hand: -1, cat_reserve: -5 }
    : { kitten: BOOP_GRID + 3, cat_hand: BOOP_GRID, cat_reserve: BOOP_GRID + 4 };
}

export function playerRestingColumn(player: PlayerId): number {
  return sideCols(player).cat_reserve;
}

export function poolSlots(player: PlayerId, column: PoolColumn): PoolSlot[] {
  const col = sideCols(player)[column];
  return POOL_ROWS.map(row => ({ row, col }));
}

/** Hand pool column tapped for placement (reserve is display-only). */
export function poolKindAtCell(player: PlayerId, row: number, col: number): PieceKind | null {
  const cols = sideCols(player);
  if (col === cols.kitten) return 'kitten';
  if (col === cols.cat_hand) return 'cat';
  return null;
}

export function isPoolCell(row: number, col: number, player: PlayerId): boolean {
  return poolKindAtCell(player, row, col) !== null;
}

export function isReserveColumn(player: PlayerId, row: number, col: number): boolean {
  const cols = sideCols(player);
  return col === cols.cat_reserve && POOL_ROWS.includes(row);
}

export function poolCellIndex(player: PlayerId, column: PoolColumn, slotIndex = 0): number | null {
  const slot = poolSlots(player, column)[slotIndex];
  if (!slot) return null;
  return cellIndex(BOOP_GRID, slot.row, slot.col, BOOP_OUTSIDE);
}

/** First pool slot that will contain a piece for this player/kind (for smoke / AI drag). */
export function primaryPoolCellIndex(player: PlayerId, kind: PieceKind): number {
  const column: PoolColumn = kind === 'kitten' ? 'kitten' : 'cat_hand';
  return poolCellIndex(player, column, 0)!;
}

/** Exterior cells currently used by visible pool / reserve stacks (resting must avoid these). */
export function poolOccupiedCells(
  player: PlayerId,
  counts: { kittens_in_hand: number; cats_in_hand: number; cats_in_reserve: number },
): PoolSlot[] {
  const out: PoolSlot[] = [];
  const pushSlots = (column: PoolColumn, count: number) => {
    poolSlots(player, column)
      .slice(0, Math.max(0, count))
      .forEach(slot => out.push(slot));
  };
  pushSlots('kitten', counts.kittens_in_hand);
  pushSlots('cat_hand', counts.cats_in_hand);
  pushSlots('cat_reserve', counts.cats_in_reserve);
  return out;
}
