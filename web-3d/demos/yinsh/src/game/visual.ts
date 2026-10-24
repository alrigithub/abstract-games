import { between, coordKey, type Coord } from './coord';
import type { Board } from './board';
import type { Move } from './state';

export function markerIdsOnRingMove(board: Board, start: Coord, end: Coord): string[] {
  const ids: string[] = [];
  for (const c of between(start, end)) {
    if (!board.hasMarkerAt(c)) continue;
    const player = board.elementColorAt(c);
    if (player) ids.push(`marker-${player}-${coordKey(c)}`);
  }
  return ids;
}

export function moveNeedsFlip(move: Move): boolean {
  return move.tag === 'MoveRing';
}
