import type { BoardSnapshot } from '@abstract/three-engine';

/** Every vase id currently in a snapshot (bed, hand pools, resting stacks). */
export function snapshotPieceIds(snapshot: BoardSnapshot): string[] {
  const ids: string[] = [];
  for (const stack of snapshot.cells) {
    for (const piece of stack) ids.push(piece.id);
  }
  return ids;
}

/** Visual-only empty board/pools for hide-then-show line celebrations. */
export function emptySnapshot(snapshot: BoardSnapshot): BoardSnapshot {
  return {
    ...snapshot,
    cells: snapshot.cells.map(() => []),
    reserves: snapshot.reserves?.map(slot => ({ ...slot, count: 0 })),
  };
}
