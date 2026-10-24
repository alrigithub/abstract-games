import * as THREE from 'three';
import { BOARD } from '../constants';
import { createContactShadowBlob } from './contact-shadow';
import type { PieceGeometrySet, ThemeId } from '../types';

export { createContactShadowBlob };

/** Canonical sizes — see `web-3d/demos/gomoku/IMPLEMENTED.md`. */
export const GOMOKU_DIMS = {
  GRID: 15,
  SLAB: 0.25,
  MARGIN: 0.55,
  LINE_W: BOARD.LINE_W,
  STAR_R: 0.055,
  STONE_R: 0.47,
  STONE_H: 0.21,
  /** Lower resting center by this fraction of stone height (visual seat on board). */
  REST_Y_DROP: 0.25,
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
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/** World Y of stone mesh center at rest: `STONE_H/2 − REST_Y_DROP×STONE_H`. */
export function gomokuStoneRestCenterY(height = GOMOKU_DIMS.STONE_H): number {
  return height / 2 - GOMOKU_DIMS.REST_Y_DROP * height;
}

/** @deprecated Use {@link gomokuStoneRestCenterY}. */
export function gomokuStoneCenterY(): number {
  return gomokuStoneRestCenterY();
}

export interface GomokuThemeMaterials {
  table: THREE.Color;
  board: THREE.MeshStandardMaterial;
  line: THREE.MeshBasicMaterial;
  star: THREE.MeshBasicMaterial;
  stoneA: THREE.MeshStandardMaterial;
  stoneB: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
}

export function gomokuThemeMaterials(theme: ThemeId): GomokuThemeMaterials {
  const dark = theme === 'dark';
  return {
    table: new THREE.Color(dark ? '#16171a' : '#ffffff'),
    board: new THREE.MeshStandardMaterial({
      color: dark ? '#22242a' : '#e8e4dc',
      roughness: dark ? 0.92 : 0.88,
      metalness: 0,
    }),
    line: new THREE.MeshBasicMaterial({ color: dark ? '#8a8f98' : '#1a1a1a', side: THREE.DoubleSide }),
    star: new THREE.MeshBasicMaterial({ color: dark ? '#8a8f98' : '#1a1a1a', side: THREE.DoubleSide }),
    stoneA: new THREE.MeshStandardMaterial({
      color: dark ? '#f5f5f2' : '#fafaf8',
      roughness: 0.32,
      metalness: 0.04,
    }),
    stoneB: new THREE.MeshStandardMaterial({
      color: dark ? '#141414' : '#242424',
      roughness: 0.88,
      metalness: 0,
    }),
    contactShadow: new THREE.MeshBasicMaterial({
      color: dark ? '#000000' : '#19232e',
      transparent: true,
      opacity: dark ? 0.45 : 0.12,
      depthWrite: false,
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
