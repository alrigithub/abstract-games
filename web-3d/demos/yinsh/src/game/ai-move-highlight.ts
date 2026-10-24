import { yinshWorldPoint } from '@abstract/three-engine';
import { coordKey, type Coord } from './coord';
import { ringPathCoords } from './ring-destinations';
import { coordToIndex } from './cells';
import type { Player } from './player';

export type AiMoveHighlight = {
  fromCell: number;
  toCell: number;
  pathCells: number[];
  pathWorld: { x: number; z: number }[];
  flipPieceIds: string[];
};

export function ringPieceId(player: Player, coord: Coord): string {
  return `ring-${player}-${coordKey(coord)}`;
}

/** Path cells must end at the ring's landing intersection. */
export function aiMovePathEndsAtDestination(pathCells: number[], toCell: number): boolean {
  return pathCells.length >= 2 && pathCells[pathCells.length - 1] === toCell;
}

export function buildAiMovePathCells(start: Coord, end: Coord): number[] {
  return ringPathCoords(start, end).map(coordToIndex);
}

/** Cell-center polyline; caller should patch the last point to the ring mesh XZ after the move. */
export function buildAiMovePathWorld(start: Coord, end: Coord): { x: number; z: number }[] {
  return ringPathCoords(start, end).map(c => {
    const p = yinshWorldPoint(c);
    return { x: p.x, z: p.z };
  });
}

export function applyRingLandingToPathWorld(
  pathWorld: { x: number; z: number }[],
  ringWorld: { x: number; z: number } | null,
): { x: number; z: number }[] {
  if (!pathWorld.length || !ringWorld) return pathWorld;
  const out = pathWorld.map(p => ({ ...p }));
  out[out.length - 1] = { x: ringWorld.x, z: ringWorld.z };
  return out;
}
