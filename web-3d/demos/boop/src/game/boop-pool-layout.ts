import { cellIndex } from '@abstract/three-engine';
import type { PieceKind, PlayerId } from './types';

const GRID = 6;
const OUTSIDE = 2;

export type PoolSlot = { row: number; col: number };

/** Eight exterior cells per pool (one upright piece each — no vertical stacking). */
const POOL_ROWS: number[] = [-1, 0, 1, 2, 3, 4, 5, 6];

function sideCols(player: PlayerId) {
  return player === 'A' ? { kitten: -2, cat: -1 } : { kitten: GRID + 1, cat: GRID };
}

export function poolSlots(player: PlayerId, kind: PieceKind): PoolSlot[] {
  const cols = sideCols(player);
  const col = kind === 'kitten' ? cols.kitten : cols.cat;
  return POOL_ROWS.map(row => ({ row, col }));
}

export function poolKindAtCell(player: PlayerId, row: number, col: number): PieceKind | null {
  const cols = sideCols(player);
  if (col === cols.kitten) return 'kitten';
  if (col === cols.cat) return 'cat';
  return null;
}

export function isPoolCell(row: number, col: number, player: PlayerId): boolean {
  return poolKindAtCell(player, row, col) !== null;
}

export function poolCellIndex(player: PlayerId, kind: PieceKind, slotIndex = 0): number | null {
  const slot = poolSlots(player, kind)[slotIndex];
  if (!slot) return null;
  return cellIndex(GRID, slot.row, slot.col, OUTSIDE);
}

/** First pool slot that will contain a piece for this player/kind (for smoke / AI drag). */
export function primaryPoolCellIndex(player: PlayerId, kind: PieceKind): number {
  return poolCellIndex(player, kind, 0)!;
}
