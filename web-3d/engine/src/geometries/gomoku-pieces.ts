import * as THREE from 'three';
import { BOARD } from '../constants';
import { themeTokens } from '../theme';
import { anchorGeometryBaseToY0 } from './anchor';
import type { PieceGeometrySet, ThemeId } from '../types';

/** Canonical sizes — see `web-3d/demos/gomoku/IMPLEMENTED.md`. */
export const GOMOKU_DIMS = {
  GRID: 15,
  SLAB: 0,
  MARGIN: 0.55,
  LINE_W: BOARD.LINE_W,
  STAR_R: 0.055,
  STONE_R: 0.47,
  /** Procedural fallback height; Alex GLB uses {@link gomokuGlbStoneHeight}. */
  STONE_H: 0.21,
} as const;

/** Alex go-stone GLB diameter (Y-up meters, origin at base centre). */
export const GOMOKU_GLB_DIAMETER_M = 0.022;
/** Alex go-stone GLB height at authored scale. */
export const GOMOKU_GLB_HEIGHT_M = 0.009;
/** Uniform scale so GLB footprint matches {@link GOMOKU_DIMS.STONE_R}. */
export const GOMOKU_GLB_WORLD_SCALE = GOMOKU_DIMS.STONE_R / (GOMOKU_GLB_DIAMETER_M / 2);

/** Resting stone height after {@link GOMOKU_GLB_WORLD_SCALE}. */
export function gomokuGlbStoneHeight(): number {
  return GOMOKU_GLB_HEIGHT_M * GOMOKU_GLB_WORLD_SCALE;
}

const HOSHI_15: readonly (readonly [number, number])[] = [
  [3, 3],
  [3, 11],
  [7, 7],
  [11, 3],
  [11, 11],
];

/** Biconvex Go stone: two spherical caps, smooth meridian (no pinched waist). */
export function createGomokuStoneGeometry(
  radius = GOMOKU_DIMS.STONE_R,
  height = GOMOKU_DIMS.STONE_H,
): THREE.BufferGeometry {
  const half = height / 2;
  const capRadius = (radius * radius + half * half) / (2 * half);
  const meridianSteps = BOARD.RADIAL_SEGMENTS * 2;
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= meridianSteps; i++) {
    const y = (i / meridianSteps) * height;
    const pole = y <= half ? y : height - y;
    const x = Math.sqrt(Math.max(0, capRadius * capRadius - (capRadius - pole) ** 2));
    profile.push(new THREE.Vector2(x, y));
  }
  const geo = new THREE.LatheGeometry(profile, BOARD.RADIAL_SEGMENTS);
  geo.computeVertexNormals();
  return anchorGeometryBaseToY0(geo);
}

/** World Y of stone mesh origin at rest (geometry base anchored at local y=0). */
export function gomokuStoneRestCenterY(_height = GOMOKU_DIMS.STONE_H): number {
  return BOARD.PLAYFIELD_SURFACE_Y;
}

/** @deprecated Use {@link gomokuStoneRestCenterY}. */
export function gomokuStoneCenterY(): number {
  return gomokuStoneRestCenterY();
}

export interface GomokuThemeMaterials {
  table: THREE.Color;
  board: THREE.MeshBasicMaterial;
  line: THREE.MeshBasicMaterial;
  star: THREE.MeshBasicMaterial;
  stoneA: THREE.MeshBasicMaterial;
  stoneB: THREE.MeshBasicMaterial;
}

export function gomokuThemeMaterials(theme: ThemeId): GomokuThemeMaterials {
  const tokens = themeTokens(theme);
  const pieceA = tokens.piece.A!;
  const pieceB = tokens.piece.B!;
  return {
    table: new THREE.Color(tokens.table),
    board: new THREE.MeshBasicMaterial({ color: tokens.board, side: THREE.DoubleSide, depthWrite: false }),
    line: new THREE.MeshBasicMaterial({ color: tokens.lines, side: THREE.DoubleSide, depthWrite: false }),
    star: new THREE.MeshBasicMaterial({ color: tokens.lines, side: THREE.DoubleSide, depthWrite: false }),
    stoneA: new THREE.MeshBasicMaterial({ color: pieceA.fill, toneMapped: false }),
    stoneB: new THREE.MeshBasicMaterial({ color: pieceB.fill, toneMapped: false }),
  };
}

export function gomokuPieceGeometrySet(geo: THREE.BufferGeometry): PieceGeometrySet {
  return {
    geometry: () => geo,
    height: () => GOMOKU_DIMS.STONE_H,
    yaw: id => {
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
      return ((hash >>> 0) % 1000) / 1000 * (Math.PI / 8);
    },
  };
}

export function gomokuHoshiPoints(size = GOMOKU_DIMS.GRID): readonly (readonly [number, number])[] {
  return size === 15 ? HOSHI_15 : HOSHI_15;
}

export function gomokuCellWorld(size: number, row: number, col: number): THREE.Vector3 {
  const origin = (size - 1) / 2;
  return new THREE.Vector3(col - origin, 0, row - origin);
}
