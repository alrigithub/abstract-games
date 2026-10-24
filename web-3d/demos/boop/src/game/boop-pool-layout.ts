import { cellIndex } from '@abstract/three-engine';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';
import type { PieceKind, PlayerId } from './types';

export type PoolSlot = { row: number; col: number };

export type PoolColumn = 'kitten' | 'cat_hand' | 'cat_reserve';

export type PoolCounts = {
  kittens_in_hand: number;
  cats_in_hand: number;
  cats_in_reserve: number;
};

/** Side rows for pool pieces (avoid row −1 above the bed — it floated big vases off-screen). */
const POOL_ROWS: number[] = [0, 1, 2, 3, 4, 5, 6, 7];

/** Empty exterior columns between the playfield edge and the nearest pool stack. */
export const POOL_GAP_CELLS_FROM_BED = 2;

/** Nearest pool column is the 3rd cell out from the bed edge (after {@link POOL_GAP_CELLS_FROM_BED} gaps). */
function frontPoolColumn(player: PlayerId): number {
  return player === 'A' ? -(POOL_GAP_CELLS_FROM_BED + 1) : BOOP_GRID + POOL_GAP_CELLS_FROM_BED;
}

/** Hand / reserve / rear-kitten columns; order matches #101 (front hand, reserve inward, kittens rear). */
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

/**
 * Small vases sit in the front depression until the player earns hand cats;
 * then kittens move to the rear column and big vases take the front row.
 */
export function kittenHandColumn(_player: PlayerId, counts: PoolCounts): PoolColumn {
  return counts.cats_in_hand > 0 ? 'kitten' : 'cat_hand';
}

export function poolSlots(player: PlayerId, column: PoolColumn): PoolSlot[] {
  const col = sideCols(player)[column];
  return POOL_ROWS.map(row => ({ row, col }));
}

function slotHasPiece(
  player: PlayerId,
  row: number,
  col: number,
  counts: PoolCounts,
): PieceKind | null {
  const cols = sideCols(player);
  const kittenCol = cols[kittenHandColumn(player, counts)];
  if (col === kittenCol && row >= 0 && row < counts.kittens_in_hand) return 'kitten';
  if (col === cols.cat_hand && row >= 0 && row < counts.cats_in_hand) return 'cat';
  return null;
}

/** Hand pool column tapped for placement (reserve is display-only). */
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
export function primaryPoolCellIndex(player: PlayerId, kind: PieceKind, counts: PoolCounts): number {
  const column: PoolColumn =
    kind === 'kitten' ? kittenHandColumn(player, counts) : 'cat_hand';
  return poolCellIndex(player, column, 0)!;
}

/** Exterior cells currently used by visible pool / reserve stacks (resting must avoid these). */
export function poolOccupiedCells(player: PlayerId, counts: PoolCounts): PoolSlot[] {
  const out: PoolSlot[] = [];
  const pushSlots = (column: PoolColumn, count: number) => {
    poolSlots(player, column)
      .slice(0, Math.max(0, count))
      .forEach(slot => out.push(slot));
  };
  pushSlots(kittenHandColumn(player, counts), counts.kittens_in_hand);
  pushSlots('cat_hand', counts.cats_in_hand);
  pushSlots('cat_reserve', counts.cats_in_reserve);
  return out;
}

/** New-game pool counts (8 kittens, no hand cats yet). */
export const BOOP_START_POOL_COUNTS: PoolCounts = {
  kittens_in_hand: 8,
  cats_in_hand: 0,
  cats_in_reserve: 8,
};
