import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOARD } from '../constants';
import { createContactShadowBlob } from './contact-shadow';
import type { ThemeTokens, Topology } from '../types';

/** Official Waltz 9×9 template: `100` = hole or outside. ±1 Tott, ±2 Tzarra, ±3 Tzaar. */
export const TZAAR_TEMPLATE: readonly number[] = [
  -1, 1, 1, 1, 1, 100, 100, 100, 100, -1, -2, 2, 2, 2, -1, 100, 100, 100, -1, -2, -3, 3, 3, -2, -1, 100, 100, -1,
  -2, -3, -1, 1, -3, -2, -1, 100, 1, 2, 3, 1, 100, -1, -3, -2, -1, 100, 1, 2, 3, -1, 1, 3, 2, 1, 100, 100, 1, 2,
  -3, -3, 3, 2, 1, 100, 100, 100, 1, -2, -2, -2, 2, 1, 100, 100, 100, 100, -1, -1, -1, -1, 1,
];

export const TZAAR_GRID = 9;
export const TZAAR_CENTER = { x: 4, y: 4 } as const;
export const TZAAR_PITCH = 1;

export type TzaarKind = 'tott' | 'tzarra' | 'tzaar';
export type TzaarPlayer = 'A' | 'B';
export type TzaarLineDir = 'e' | 'se' | 'sw';

export interface TzaarCell {
  index: number;
  x: number;
  y: number;
  world: { x: number; z: number };
}

export interface TzaarStartPiece {
  index: number;
  x: number;
  y: number;
  player: TzaarPlayer;
  kind: TzaarKind;
}

const SQRT3_2 = Math.sqrt(3) / 2;

const LINE_DIRS: { dx: number; dy: number; dir: TzaarLineDir }[] = [
  { dx: 1, dy: 0, dir: 'e' },
  { dx: 0, dy: 1, dir: 'se' },
  { dx: 1, dy: -1, dir: 'sw' },
];

function kindFromAbs(value: number): TzaarKind {
  if (value === 3) return 'tzaar';
  if (value === 2) return 'tzarra';
  return 'tott';
}

export function tzaarIsPlayable(x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= TZAAR_GRID || y >= TZAAR_GRID) {
    return false;
  }
  return TZAAR_TEMPLATE[y * TZAAR_GRID + x] !== 100;
}

/** Axial-style 9×9 embedding, centered so the empty hole sits at the origin. */
export function tzaarWorldPosition(x: number, y: number): THREE.Vector3 {
  const q = x - TZAAR_CENTER.x;
  const r = y - TZAAR_CENTER.y;
  return new THREE.Vector3(q - r * 0.5, 0, -r * SQRT3_2);
}

export function tzaarPlayableCells(): TzaarCell[] {
  const cells: TzaarCell[] = [];
  for (let y = 0; y < TZAAR_GRID; y++) {
    for (let x = 0; x < TZAAR_GRID; x++) {
      if (!tzaarIsPlayable(x, y)) continue;
      const world = tzaarWorldPosition(x, y);
      cells.push({ index: cells.length, x, y, world: { x: world.x, z: world.z } });
    }
  }
  return cells;
}

export function tzaarCornerCoords(): [number, number][] {
  return [
    [0, 0],
    [4, 0],
    [8, 4],
    [8, 8],
    [4, 8],
    [0, 4],
  ];
}

export function tzaarFixedStart(): TzaarStartPiece[] {
  return tzaarPlayableCells().map(cell => {
    const value = TZAAR_TEMPLATE[cell.y * TZAAR_GRID + cell.x]!;
    return {
      index: cell.index,
      x: cell.x,
      y: cell.y,
      player: value > 0 ? 'A' : 'B',
      kind: kindFromAbs(Math.abs(value)),
    };
  });
}

export function tzaarGridLineSegments(): { from: THREE.Vector3; to: THREE.Vector3; dir: TzaarLineDir }[] {
  const segs: { from: THREE.Vector3; to: THREE.Vector3; dir: TzaarLineDir }[] = [];
  for (const { dx, dy, dir } of LINE_DIRS) {
    for (const cell of tzaarPlayableCells()) {
      const nx = cell.x + dx;
      const ny = cell.y + dy;
      if (!tzaarIsPlayable(nx, ny)) continue;
      segs.push({
        from: tzaarWorldPosition(cell.x, cell.y),
        to: tzaarWorldPosition(nx, ny),
        dir,
      });
    }
  }
  return segs;
}

export function createTzaarBoardLineGeometry(lineW = BOARD.LINE_W): THREE.BufferGeometry {
  const geos = tzaarGridLineSegments().map(seg => {
    const dx = seg.to.x - seg.from.x;
    const dz = seg.to.z - seg.from.z;
    const len = Math.hypot(dx, dz);
    const geo = new THREE.PlaneGeometry(len + lineW, lineW);
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(-Math.atan2(dz, dx));
    geo.translate((seg.from.x + seg.to.x) / 2, 0.002, (seg.from.z + seg.to.z) / 2);
    return geo;
  });
  const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry();
  for (const geo of geos) geo.dispose();
  merged.computeBoundingBox();
  return merged;
}

/** Regular hexagonal slab matching the six outline vertices, slightly oversized. */
export function createTzaarBoardSlabGeometry(slab = BOARD.SLAB, margin = 0.55): THREE.BufferGeometry {
  const radius = 4 + margin;
  const geo = new THREE.CylinderGeometry(radius, radius, slab, 6, 1, false);
  geo.translate(0, -slab / 2, 0);
  geo.computeBoundingBox();
  return geo;
}

export function tzaarBoardExtent(): number {
  return 9.1;
}

export function createTzaarBoardGroup(tokens: ThemeTokens): THREE.Group {
  const group = new THREE.Group();
  const slabMat = new THREE.MeshBasicMaterial({ color: tokens.board, side: THREE.DoubleSide, toneMapped: false });
  const lineMat = new THREE.MeshBasicMaterial({ color: tokens.lines, side: THREE.DoubleSide, toneMapped: false });
  const slab = new THREE.Mesh(createTzaarBoardSlabGeometry(), slabMat);
  const lines = new THREE.Mesh(createTzaarBoardLineGeometry(), lineMat);
  lines.renderOrder = 1;
  group.add(slab, lines, createContactShadowBlob(tzaarBoardExtent()));
  return group;
}

export function createTzaarHexTopology(): Topology {
  const cells = tzaarPlayableCells();
  const pos = (index: number) => {
    const cell = cells[index];
    return cell ? new THREE.Vector3(cell.world.x, 0, cell.world.z) : new THREE.Vector3();
  };
  return {
    cellPosition: (index, _snapshot) => pos(index),
    cellAtWorld(x, z, _snapshot) {
      let best: number | null = null;
      let bestD = TZAAR_PITCH * 0.48;
      for (const cell of cells) {
        const d = Math.hypot(cell.world.x - x, cell.world.z - z);
        if (d < bestD) {
          bestD = d;
          best = cell.index;
        }
      }
      return best;
    },
    projectCell: (index, _snapshot) => pos(index),
  };
}
