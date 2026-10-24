import * as THREE from 'three';
import { BOARD } from '../constants';
import type { EnginePiece, PieceGeometrySet, ThemeTokens } from '../types';
import { anchorGeometryBaseToY0 } from './anchor';

/** Physical set ratios from `yinsh_gui` (annulus 20–25 mm, marker Ø32 mm). */
export const YINSH = {
  SPACING: 1,
  /** Outer radius 25 mm at 80 mm spacing. */
  RING_OUTER: 0.3125,
  /** Inner hole 20 mm — wide enough for a marker with clearance. */
  RING_INNER: 0.22,
  /** Marker radius 16 mm — solid disc inside the ring hole. */
  MARKER_RADIUS: 0.16,
  RING_HEIGHT: 0.056,
  MARKER_HEIGHT: 0.014,
  EDGE_THRESHOLD: 18,
} as const;

function flatAnnulus(inner: number, outer: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: BOARD.RADIAL_SEGMENTS });
  geo.rotateX(-Math.PI / 2);
  return anchorGeometryBaseToY0(geo);
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
  return anchorGeometryBaseToY0(geo);
}

export function yinshMarkerMaterials(player: string, tokens: ThemeTokens): THREE.Material[] {
  const white = tokens.piece.A!.fill;
  const black = tokens.piece.B!.fill;
  const edge = tokens.lines;
  const topColor = player === 'A' ? white : black;
  const bottomColor = player === 'A' ? black : white;
  return [
    new THREE.MeshBasicMaterial({ color: topColor, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: bottomColor, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: edge, toneMapped: false }),
  ];
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
    edgeThreshold: YINSH.EDGE_THRESHOLD,
    useOutline(piece: EnginePiece) {
      return piece.shape === 'ring';
    },
    materialFor(piece: EnginePiece, tokens: ThemeTokens) {
      if (piece.shape !== 'marker') return null;
      return yinshMarkerMaterials(piece.player, tokens);
    },
    verticalOffset(piece: EnginePiece, stackIndex: number, stack: EnginePiece[]) {
      if (piece.shape !== 'marker' || stackIndex === 0) return 0;
      const hasRingBelow = stack.slice(0, stackIndex).some(p => p.shape === 'ring');
      if (!hasRingBelow) return 0;
      return -ringHeight;
    },
    yaw(id: string) {
      if (!id.startsWith('ring')) return 0;
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
      return ((hash >>> 0) % 1000) / 1000 * (Math.PI / 12);
    },
  };
}
