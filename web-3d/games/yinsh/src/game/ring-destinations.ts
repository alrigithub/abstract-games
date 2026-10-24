import type { Board } from './board';
import { between, coordEq, type Coord } from './coord';

/** Legal ring move endpoints from {@link Board.ringMoves}. */
export function ringDestinationCoords(board: Board, start: Coord): Coord[] {
  return board.ringMoves(start);
}

/** Intersections visited along a legal ring slide (inclusive). */
export function ringPathCoords(start: Coord, end: Coord): Coord[] {
  if (coordEq(start, end)) return [start];
  const mids = between(start, end);
  return [start, ...mids, end];
}

export function isRingDestination(board: Board, start: Coord, end: Coord): boolean {
  return board.isValidRingMove(start, end);
}
