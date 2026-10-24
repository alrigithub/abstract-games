import * as THREE from 'three';
import { BOARD } from '../constants';
import type { EnginePiece, PieceGeometrySet, ThemeTokens } from '../types';
import { anchorGeometryBaseToY0 } from './anchor';
import { GIPF_CHIP, createGipfChipGeometry } from './gipf-set';

const HOLE_CLEARANCE = 0.026;
const RING_WALL = 0.088;

/** Physical ring: hole clears the GIPF marker; wall thickness ≈ ring height. */
export const YINSH = {
  SPACING: 1,
  /** Radial gap between chip and inner bore (world units, ~1 mm at GIPF scale). */
  HOLE_CLEARANCE,
  /** Radial wall thickness (also sets ring height). */
  RING_WALL,
  RING_INNER: GIPF_CHIP.RADIUS + HOLE_CLEARANCE,
  RING_OUTER: GIPF_CHIP.RADIUS + HOLE_CLEARANCE + RING_WALL,
  RING_HEIGHT: RING_WALL,
  /** Corner radius on the wall cross-section (rounded-rect / torus-like). */
  CORNER_RATIO: 0.22,
  /** Smooth hole and outer rim (no visible faceting). */
  LATHE_SEGMENTS: BOARD.RADIAL_SEGMENTS * 4,
  CORNER_ARC_STEPS: 20,
  /** Hide lathe facet lines; keep rim silhouettes (match Gomoku stone readability). */
  EDGE_THRESHOLD: 42,
} as const;

function arcPoints(
  cx: number,
  cy: number,
  radius: number,
  fromAngle: number,
  toAngle: number,
  steps: number,
): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = fromAngle + (toAngle - fromAngle) * t;
    out.push(new THREE.Vector2(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius));
  }
  return out;
}

/** Lathe profile for a thick plastic annulus (rounded rectangle cross-section). */
function ringWallProfile(inner: number, outer: number, height: number): THREE.Vector2[] {
  const wall = outer - inner;
  const r = Math.min(wall * YINSH.CORNER_RATIO, height * 0.45, wall * 0.48);
  const steps = YINSH.CORNER_ARC_STEPS;
  const profile: THREE.Vector2[] = [];
  profile.push(new THREE.Vector2(inner + r, 0));
  profile.push(...arcPoints(inner + r, r, r, -Math.PI / 2, Math.PI, steps));
  profile.push(new THREE.Vector2(inner, height - r));
  profile.push(...arcPoints(inner + r, height - r, r, Math.PI, Math.PI / 2, steps));
  profile.push(new THREE.Vector2(outer - r, height));
  profile.push(...arcPoints(outer - r, height - r, r, Math.PI / 2, 0, steps));
  profile.push(new THREE.Vector2(outer, r));
  profile.push(...arcPoints(outer - r, r, r, 0, -Math.PI / 2, steps));
  return profile;
}

export function createYinshRingGeometry(): THREE.BufferGeometry {
  const profile = ringWallProfile(YINSH.RING_INNER, YINSH.RING_OUTER, YINSH.RING_HEIGHT);
  const geo = new THREE.LatheGeometry(profile, YINSH.LATHE_SEGMENTS);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return anchorGeometryBaseToY0(geo);
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

const MARKER_LATHE_SEGMENTS = BOARD.RADIAL_SEGMENTS * 2;

export function createYinshMarkerGeometry(): THREE.BufferGeometry {
  const geo = createGipfChipGeometry(MARKER_LATHE_SEGMENTS);
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
