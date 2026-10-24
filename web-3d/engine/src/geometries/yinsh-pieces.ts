import * as THREE from 'three';
import { BOARD } from '../constants';
import type { EnginePiece, PieceGeometrySet } from '../types';

/** Physical set ratios from `yinsh_gui` (annulus 20–25 mm, marker Ø32 mm). */
export const YINSH = {
  /** Distance between hex intersection centers (world units). */
  SPACING: 1,
  /** Ring outer radius (25/80 of legacy spacing). */
  RING_OUTER: 0.3125,
  /** Ring inner radius (hole for marker). */
  RING_INNER: 0.25,
  /** Marker disc radius. */
  MARKER_RADIUS: 0.2,
  /** Flat ring thickness (~8% of outer diameter). */
  RING_HEIGHT: 0.05,
  /** Two-sided marker disc thickness (~6% of marker diameter). */
  MARKER_HEIGHT: 0.012,
  /** Crease edges on the low ring profile. */
  EDGE_THRESHOLD: 12,
} as const;

function flatAnnulus(inner: number, outer: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: BOARD.RADIAL_SEGMENTS });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, depth / 2, 0);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function createYinshRingGeometry(): THREE.BufferGeometry {
  return flatAnnulus(YINSH.RING_INNER, YINSH.RING_OUTER, YINSH.RING_HEIGHT);
}

export function createYinshMarkerGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(
    YINSH.MARKER_RADIUS,
    YINSH.MARKER_RADIUS,
    YINSH.MARKER_HEIGHT,
    BOARD.RADIAL_SEGMENTS,
    1,
    false,
  );
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function yinshPieceGeometrySet(ring: THREE.BufferGeometry, marker: THREE.BufferGeometry): PieceGeometrySet {
  const ringBox = ring.boundingBox!;
  const ringHeight = ringBox.max.y - ringBox.min.y;
  const markerHeight = marker.boundingBox!.max.y - marker.boundingBox!.min.y;

  return {
    geometry(piece: EnginePiece) {
      return piece.shape === 'marker' ? marker : ring;
    },
    height(piece: EnginePiece) {
      return piece.shape === 'marker' ? markerHeight : ringHeight;
    },
    verticalOffset(piece: EnginePiece, stackIndex: number, stack: EnginePiece[]) {
      if (piece.shape !== 'marker' || stackIndex === 0) return 0;
      const hasRingBelow = stack.slice(0, stackIndex).some(p => p.shape === 'ring');
      if (!hasRingBelow) return 0;
      return -(ringHeight - markerHeight * 0.5);
    },
    yaw(id: string) {
      if (!id.startsWith('ring')) return 0;
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
      return ((hash >>> 0) % 1000) / 1000 * (Math.PI / 10);
    },
  };
}
