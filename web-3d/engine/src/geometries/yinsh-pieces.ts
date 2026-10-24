import * as THREE from 'three';
import { BOARD } from '../constants';
import type { EnginePiece, PieceGeometrySet, ThemeTokens } from '../types';
import { anchorGeometryBaseToY0 } from './anchor';
import { GIPF_CHIP, createGipfChipGeometry } from './gipf-set';

/** Yinsh ring annulus — inner hole fits the shared GIPF chip with clearance. */
export const YINSH = {
  SPACING: 1,
  RING_INNER: GIPF_CHIP.RADIUS + 0.028,
  RING_OUTER: 0.48,
  RING_HEIGHT: 0.056,
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

/** Match {@link THREE.CylinderGeometry} groups: 0 side, 1 top cap, 2 bottom cap. */
function assignGipfChipFlipGroups(geo: THREE.BufferGeometry): void {
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const maxY = box.max.y;
  const minY = box.min.y;
  const eps = GIPF_CHIP.HEIGHT * 0.08;
  const pos = geo.getAttribute('position');
  const index = geo.getIndex();
  if (!index) return;

  const side: number[] = [];
  const top: number[] = [];
  const bottom: number[] = [];

  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i);
    const ib = index.getX(i + 1);
    const ic = index.getX(i + 2);
    const avgY = (pos.getY(ia) + pos.getY(ib) + pos.getY(ic)) / 3;
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    if (avgY >= maxY - eps) top.push(...tri);
    else if (avgY <= minY + eps) bottom.push(...tri);
    else side.push(...tri);
  }

  const merged = [...side, ...top, ...bottom];
  geo.setIndex(merged);
  geo.clearGroups();
  let start = 0;
  if (side.length) {
    geo.addGroup(start, side.length, 0);
    start += side.length;
  }
  if (top.length) {
    geo.addGroup(start, top.length, 1);
    start += top.length;
  }
  if (bottom.length) geo.addGroup(start, bottom.length, 2);
}

export function createYinshMarkerGeometry(): THREE.BufferGeometry {
  const geo = createGipfChipGeometry();
  assignGipfChipFlipGroups(geo);
  return anchorGeometryBaseToY0(geo);
}

export function yinshMarkerMaterials(player: string, tokens: ThemeTokens): THREE.Material[] {
  const white = tokens.piece.A!.fill;
  const black = tokens.piece.B!.fill;
  const edge = tokens.lines;
  const topColor = player === 'A' ? white : black;
  const bottomColor = player === 'A' ? black : white;
  return [
    new THREE.MeshBasicMaterial({ color: edge, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: topColor, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: bottomColor, toneMapped: false }),
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
