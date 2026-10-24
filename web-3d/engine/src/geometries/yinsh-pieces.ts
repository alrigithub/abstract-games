import * as THREE from 'three';
import { BOARD } from '../constants';
import type { EnginePiece, PieceBuildContext, PieceGeometrySet, ThemeTokens } from '../types';
import { anchorGeometryBaseToY0 } from './anchor';
import {
  GIPF_CHIP,
  createGipfChipGeometry,
  createGipfChipRimGeometry,
} from './gipf-set';
import { decoratePieceMesh } from './piece-outlines';
const HOLE_CLEARANCE = 0.026;
const RING_WALL = 0.102;

/** Physical ring: taller than a GIPF marker, rounded wall (lathe profile). */
export const YINSH = {
  SPACING: 1,
  HOLE_CLEARANCE,
  RING_WALL,
  RING_INNER: GIPF_CHIP.RADIUS + HOLE_CLEARANCE,
  RING_OUTER: GIPF_CHIP.RADIUS + HOLE_CLEARANCE + RING_WALL,
  RING_HEIGHT: 0.21,
  CORNER_RATIO: 0.22,
  /** Match Tzaar emblem / extrude curve density. */
  LATHE_SEGMENTS: GIPF_CHIP.SEGMENTS * 2,
  CORNER_ARC_STEPS: 12,
  EDGE_THRESHOLD: BOARD.EDGE_THRESHOLD_TAK,
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

const markerDiscGeo = anchorGeometryBaseToY0(createGipfChipGeometry());
const markerRimGeo = createGipfChipRimGeometry();

/** Shadow / height proxy (disc only). */
export function createYinshMarkerGeometry(): THREE.BufferGeometry {
  return markerDiscGeo;
}

function basic(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}

/** Tzaar-style GIPF chip: lathe disc + printed rim, separate decorated meshes. */
export function createYinshMarkerMesh(player: string, ctx: PieceBuildContext): THREE.Group {
  const palette = ctx.tokens.piece[player] ?? ctx.tokens.piece.A!;
  const edge = new THREE.LineBasicMaterial({ color: palette.edge, transparent: true, opacity: 0.85 });
  const outline = basic(ctx.tokens.lines);
  outline.side = THREE.BackSide;
  const group = new THREE.Group();
  group.userData.gipfMarker = true;
  const disc = decoratePieceMesh(new THREE.Mesh(markerDiscGeo, basic(palette.fill)), edge, outline, ctx.edgeCache);
  const rim = decoratePieceMesh(new THREE.Mesh(markerRimGeo, basic(palette.rim)), edge, outline, ctx.edgeCache);
  group.add(disc, rim);
  return group;
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

export function refreshYinshMarkerMesh(root: THREE.Object3D, player: string, ctx: PieceBuildContext): void {
  if (!(root instanceof THREE.Group) || !root.userData.gipfMarker) return;
  const replacement = createYinshMarkerMesh(player, ctx);
  root.clear();
  for (const child of replacement.children) root.add(child);
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
    materialFor(piece: EnginePiece, tokens) {
      if (piece.shape !== 'marker') return null;
      return yinshMarkerMaterials(piece.player, tokens);
    },
    verticalOffset(piece: EnginePiece, stackIndex: number, stack: EnginePiece[]) {
      if (piece.shape !== 'marker' || stackIndex === 0) return 0;
      const hasRingBelow = stack.slice(0, stackIndex).some(p => p.shape === 'ring');
      if (!hasRingBelow) return 0;
      return -ringHeight + GIPF_CHIP.HEIGHT * 0.06;
    },
    yaw(id: string) {
      if (!id.startsWith('ring')) return 0;
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
      return ((hash >>> 0) % 1000) / 1000 * (Math.PI / 12);
    },
  };
}
