import * as THREE from 'three';
import { BOARD } from '../constants';
import { themeTokens } from '../theme';
import { anchorGeometryBaseToY0 } from './anchor';
import { createContactShadowBlob } from './contact-shadow';
import type { PieceGeometrySet, ThemeId } from '../types';

export { createContactShadowBlob };

/** Canonical sizes — see `web-3d/demos/gomoku/IMPLEMENTED.md`. */
export const GOMOKU_DIMS = {
  GRID: 15,
  SLAB: 0,
  MARGIN: 0.55,
  LINE_W: BOARD.LINE_W,
  STAR_R: 0.055,
  STONE_R: 0.47,
  STONE_H: 0.21,
} as const;

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
  stoneShadow: THREE.MeshBasicMaterial;
}

export function gomokuThemeMaterials(theme: ThemeId): GomokuThemeMaterials {
  const tokens = themeTokens(theme);
  const pieceA = tokens.piece.A!;
  const pieceB = tokens.piece.B!;
  return {
    table: new THREE.Color(tokens.table),
    board: new THREE.MeshBasicMaterial({ color: tokens.board, side: THREE.DoubleSide }),
    line: new THREE.MeshBasicMaterial({ color: tokens.lines, side: THREE.DoubleSide }),
    star: new THREE.MeshBasicMaterial({ color: tokens.lines, side: THREE.DoubleSide }),
    stoneA: new THREE.MeshBasicMaterial({ color: pieceA.fill, toneMapped: false }),
    stoneB: new THREE.MeshBasicMaterial({ color: pieceB.fill, toneMapped: false }),
    stoneShadow: new THREE.MeshBasicMaterial({
      color: tokens.shadow,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
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
