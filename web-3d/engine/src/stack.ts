import { INTERACTION } from './constants';
import type { BoardSnapshot, EnginePiece, ReservePick, Selection } from './types';

export function countSelected(elapsedMs: number, height: number, interval: number = INTERACTION.HOLD_INTERVAL): number {
  const duration = Number.isFinite(interval) && interval > 0 ? interval : INTERACTION.HOLD_INTERVAL;
  return Math.max(0, Math.min(height, 1 + Math.floor(Math.max(0, elapsedMs) / duration)));
}

/** Moves the selected top suffix as one stack, preserving bottom-to-top order. */
export function moveStackSuffix(
  snapshot: BoardSnapshot,
  selection: Selection,
  target: number,
  createPiece?: (piece: EnginePiece, index: number) => EnginePiece,
): BoardSnapshot {
  if (target < 0 || target >= snapshot.cellCount) return snapshot;
  const destination = snapshot.cells[target] ?? [];
  if (typeof selection.source === 'number') {
    const source = selection.source;
    if (source < 0 || source >= snapshot.cellCount || source === target) return snapshot;
    const stack = snapshot.cells[source] ?? [];
    const count = Math.min(stack.length, Math.max(0, Math.floor(selection.count)));
    if (!count || !Number.isFinite(count)) return snapshot;
    const moved = stack.slice(-count);
    const cells = snapshot.cells.map((cell, i) => {
      if (i === source) return stack.slice(0, stack.length - count);
      if (i === target) {
        const placed = createPiece ? moved.map((p, j) => createPiece(p, j)) : moved;
        return [...destination, ...placed];
      }
      return cell;
    });
    return { ...snapshot, cells };
  }
  return snapshot;
}

export function topSuffix(snapshot: BoardSnapshot, source: number, count: number): EnginePiece[] {
  const stack = snapshot.cells[source] ?? [];
  const n = Math.min(stack.length, Math.max(0, Math.floor(count)));
  return stack.slice(-n);
}

export function stackHeight(pieces: EnginePiece[], heightOf: (p: EnginePiece) => number): number {
  return pieces.reduce((sum, piece) => sum + heightOf(piece), 0);
}

export function reserveKey(pick: ReservePick): string {
  return `${pick.player}:${pick.shape}:${pick.pile}`;
}
