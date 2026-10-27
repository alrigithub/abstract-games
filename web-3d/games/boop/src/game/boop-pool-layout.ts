import { cellIndex } from '@abstract/three-engine';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';
import type { PieceKind, PlayerId } from './types';

export type PoolSlot = { row: number; col: number };

/** @deprecated Reserve/rear columns are not rendered; hand uses {@link HAND_COLUMN} only. */
export type PoolColumn = 'kitten' | 'cat_hand' | 'cat_reserve';

export type PoolCounts = {
  kittens_in_hand: number;
  cats_in_hand: number;
  cats_in_reserve: number;
};

/** Side rows for pool pieces: eight slots centered on the 6×6 bed (midpoint at row 2.5). */
const POOL_ROWS: number[] = [-1, 0, 1, 2, 3, 4, 5, 6];

/** Empty exterior columns between the playfield edge and the nearest pool stack. */
export const POOL_GAP_CELLS_FROM_BED = 2;

/** Nearest pool column is the 3rd cell out from the bed edge (after {@link POOL_GAP_CELLS_FROM_BED} gaps). */
function frontPoolColumn(player: PlayerId): number {
  return player === 'A' ? -(POOL_GAP_CELLS_FROM_BED + 1) : BOOP_GRID + POOL_GAP_CELLS_FROM_BED;
}

export const HAND_COLUMN: PoolColumn = 'cat_hand';

function sideCols(player: PlayerId): Record<PoolColumn, number> {
  const front = frontPoolColumn(player);
  return player === 'A'
    ? { cat_hand: front, cat_reserve: front - 1, kitten: front - 3 }
    : { cat_hand: front, cat_reserve: front + 1, kitten: front + 3 };
}

/** Booped-off pieces rest on the near lip (gap columns), not on pool stacks. */
export function playerRestingColumn(player: PlayerId): number {
  return player === 'A' ? -2 : BOOP_GRID + 1;
}

/** Player hand is always the front side column (small vases fill it until earned cats replace low slots). */
export function kittenHandColumn(_player: PlayerId, _counts: PoolCounts): PoolColumn {
  return HAND_COLUMN;
}

export function poolSlots(player: PlayerId, column: PoolColumn): PoolSlot[] {
  const col = sideCols(player)[column];
  return POOL_ROWS.map(row => ({ row, col }));
}

export function handPieceCount(counts: PoolCounts): number {
  return counts.kittens_in_hand + counts.cats_in_hand;
}

/** Slot index within the hand column for the first piece of this kind (cats occupy low rows). */
export function handSlotStartIndex(kind: PieceKind, counts: PoolCounts): number {
  return kind === 'cat' ? 0 : counts.cats_in_hand;
}

function slotHasPiece(
  player: PlayerId,
  row: number,
  col: number,
  counts: PoolCounts,
): PieceKind | null {
  const handCol = sideCols(player)[HAND_COLUMN];
  if (col !== handCol) return null;
  if (row >= 0 && row < counts.cats_in_hand) return 'cat';
  if (row >= counts.cats_in_hand && row < handPieceCount(counts)) return 'kitten';
  return null;
}

/** Hand pool column tapped for placement. */
export function poolKindAtCell(
  player: PlayerId,
  row: number,
  col: number,
  counts: PoolCounts,
): PieceKind | null {
  return slotHasPiece(player, row, col, counts);
}

export function isPoolCell(row: number, col: number, player: PlayerId, counts: PoolCounts): boolean {
  return poolKindAtCell(player, row, col, counts) !== null;
}

export function isReserveColumn(_player: PlayerId, _row: number, _col: number): boolean {
  return false;
}

export function poolCellIndex(player: PlayerId, column: PoolColumn, slotIndex = 0): number | null {
  const slot = poolSlots(player, column)[slotIndex];
  if (!slot) return null;
  return cellIndex(BOOP_GRID, slot.row, slot.col, BOOP_OUTSIDE);
}

/** First pool slot that will contain a piece for this player/kind (for smoke / AI drag). */
export function primaryPoolCellIndex(player: PlayerId, kind: PieceKind, counts: PoolCounts): number {
  return poolCellIndex(player, HAND_COLUMN, handSlotStartIndex(kind, counts))!;
}

/** Exterior cells currently used by visible hand stacks (resting must avoid these). */
export function poolOccupiedCells(player: PlayerId, counts: PoolCounts): PoolSlot[] {
  return poolSlots(player, HAND_COLUMN).slice(0, Math.max(0, handPieceCount(counts)));
}

/** New-game pool counts (8 kittens, no hand cats yet). */
export const BOOP_START_POOL_COUNTS: PoolCounts = {
  kittens_in_hand: 8,
  cats_in_hand: 0,
  cats_in_reserve: 8,
};
