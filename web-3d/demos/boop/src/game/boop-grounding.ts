import { BOARD, boopPieceGeometrySet, type EnginePiece, type PieceGeometrySet } from '@abstract/three-engine';
import type * as THREE from 'three';

/** Top Y of the default square board slab (grid plane at y≈0). */
export function boardPlayfieldTopY(boardSlab = BOARD.SLAB): number {
  void boardSlab;
  return BOARD.PLAYFIELD_SURFACE_Y;
}

/**
 * Boop lathe/cylinder pieces are base-anchored at local y=0, but the shared stack
 * layout treats mesh.position.y as the piece center. Shift each piece down by half
 * its height so the base rests on the playfield (same approach as Tak capstone anchor).
 */
export function createGroundedBoopPieces(
  cat: THREE.BufferGeometry,
  kitten: THREE.BufferGeometry,
): PieceGeometrySet {
  const base = boopPieceGeometrySet(cat, kitten);
  return {
    ...base,
    geometryOrigin: 'base' as const,
  };
}

export function pieceBaseOffsetFromGeometry(geometry: THREE.BufferGeometry): number {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const h = box.max.y - box.min.y;
  return -h / 2;
}
