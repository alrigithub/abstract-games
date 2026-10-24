import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOARD } from '../constants';
import { createContactShadowBlob } from './contact-shadow';
import type { BoardBuildContext, BoardSnapshot, ThemeTokens, Topology } from '../types';

/** Official Waltz 9×9 template: `100` = hole or outside. ±1 Tott, ±2 Tzarra, ±3 Tzaar. */
export const TZAAR_TEMPLATE: readonly number[] = [
  -1, 1, 1, 1, 1, 100, 100, 100, 100, -1, -2, 2, 2, 2, -1, 100, 100, 100, -1, -2, -3, 3, 3, -2, -1, 100, 100, -1,
  -2, -3, -1, 1, -3, -2, -1, 100, 1, 2, 3, 1, 100, -1, -3, -2, -1, 100, 1, 2, 3, -1, 1, 3, 2, 1, 100, 100, 1, 2,
  -3, -3, 3, 2, 1, 100, 100, 100, 1, -2, -2, -2, 2, 1, 100, 100, 100, 100, -1, -1, -1, -1, 1,
];

export const TZAAR_GRID = 9;
export const TZAAR_CENTER = { x: 4, y: 4 } as const;
export const TZAAR_PITCH = 1;
/** Square playing surface. Vertex-to-edge margin ~1.4 pitch so the GIPF cream corners read in 45° view. */
export const TZAAR_BOARD_SIDE = 10.8;
/** Thin painted rim, ~1% of the physical board. */
export const TZAAR_RIM_W = 0.09;
/** Printed line weight: Wikimedia blank board is ~2/450 of the square; keep it hairline but readable in ortho. */
export const TZAAR_LINE_W = 0.02;
/** Small printed hex in the hole; radius stays inside the first-ring discs (r=0.38 at distance 1). */
export const TZAAR_CENTER_HEX = 0.52;

export type TzaarKind = 'tott' | 'tzarra' | 'tzaar';
export type TzaarPlayer = 'A' | 'B';
export type TzaarLineDir = 'e' | 's' | 'se';

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

/** True hex-lattice steps of `tzaarWorldPosition` (pitch 1). Not the √3 template diagonal (1, −1). */
const LINE_DIRS: { dx: number; dy: number; dir: TzaarLineDir }[] = [
  { dx: 1, dy: 0, dir: 'e' },
  { dx: 0, dy: 1, dir: 's' },
  { dx: 1, dy: 1, dir: 'se' },
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

/**
 * Pointy-top triangular lattice, pitch 1, empty hole at the origin.
 * Shared by board lines, centre motif, topology, and piece placement.
 */
export function tzaarWorldPosition(x: number, y: number): THREE.Vector3 {
  const q = x - TZAAR_CENTER.x;
  const r = y - TZAAR_CENTER.y;
  return new THREE.Vector3(q * SQRT3_2, BOARD.PLAYFIELD_SURFACE_Y, q * 0.5 - r);
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

/** Occupied-or-centre counts along one 9×9 axis (middle 9 includes the hole). */
export function tzaarRowCounts(axis: 'x' | 'y'): number[] {
  const counts: number[] = [];
  for (let i = 0; i < TZAAR_GRID; i++) {
    let n = 0;
    for (let j = 0; j < TZAAR_GRID; j++) {
      const x = axis === 'x' ? i : j;
      const y = axis === 'x' ? j : i;
      if (tzaarIsPlayable(x, y) || (x === TZAAR_CENTER.x && y === TZAAR_CENTER.y)) n++;
    }
    counts.push(n);
  }
  return counts;
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

function linePlane(from: THREE.Vector3, to: THREE.Vector3, width: number): THREE.BufferGeometry {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  const geo = new THREE.PlaneGeometry(width, len + width);
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(Math.atan2(dx, dz));
  geo.translate((from.x + to.x) / 2, 0.002, (from.z + to.z) / 2);
  return geo;
}

export function createTzaarBoardLineGeometry(lineW = TZAAR_LINE_W): THREE.BufferGeometry {
  const geos = tzaarGridLineSegments().map(seg => linePlane(seg.from, seg.to, lineW));
  const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry();
  for (const geo of geos) geo.dispose();
  merged.computeBoundingBox();
  return merged;
}

/** Square cream slab; top face at the playfield surface so discs sit flush. */
export function createTzaarBoardSlabGeometry(slab = BOARD.SLAB): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(TZAAR_BOARD_SIDE, slab, TZAAR_BOARD_SIDE);
  geo.translate(0, -slab / 2, 0);
  geo.computeBoundingBox();
  return geo;
}

export function createTzaarRimGeometry(slab = BOARD.SLAB): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(TZAAR_BOARD_SIDE, slab, TZAAR_BOARD_SIDE);
  geo.translate(0, -slab / 2, 0);
  geo.computeBoundingBox();
  return geo;
}

export function createTzaarFieldGeometry(slab = BOARD.SLAB): THREE.BufferGeometry {
  const inner = TZAAR_BOARD_SIDE - 2 * TZAAR_RIM_W;
  const geo = new THREE.BoxGeometry(inner, slab, inner);
  geo.translate(0, -slab / 2 + 0.001, 0);
  geo.computeBoundingBox();
  return geo;
}

export function tzaarCenterRingVertices(radius = TZAAR_CENTER_HEX): THREE.Vector3[] {
  const verts: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    verts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return verts;
}

export function createTzaarCenterFillGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.004, 6);
  geo.rotateY(Math.PI / 6);
  geo.translate(0, 0.003, 0);
  geo.computeBoundingBox();
  return geo;
}

export function createTzaarCenterRingGeometry(lineW = TZAAR_LINE_W): THREE.BufferGeometry {
  const verts = tzaarCenterRingVertices();
  const geos = verts.map((from, i) => linePlane(from, verts[(i + 1) % verts.length]!, lineW));
  const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry();
  for (const geo of geos) geo.dispose();
  merged.computeBoundingBox();
  return merged;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return 1;
  return ((n >> 16 & 255) + (n >> 8 & 255) + (n & 255)) / 765;
}

export function tzaarPrintColors(tokens: ThemeTokens): { field: string; rim: string; lines: string; centre: string } {
  const dark = luminance(tokens.board) < 0.45;
  return {
    field: tokens.board,
    rim: dark ? '#07080a' : '#1b1916',
    lines: tokens.lines,
    centre: dark ? '#2c3038' : '#c9c2b6',
  };
}

function basic(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false });
}

export function tzaarBoardExtent(): number {
  return TZAAR_BOARD_SIDE;
}

function addTzaarBoardMeshes(
  group: THREE.Group,
  tokens: ThemeTokens,
  boardGeometries?: THREE.BufferGeometry[],
  shared?: { field?: THREE.MeshBasicMaterial; lines?: THREE.MeshBasicMaterial },
): void {
  const print = tzaarPrintColors(tokens);
  const rimMat = basic(print.rim);
  const fieldMat = shared?.field ?? basic(print.field);
  const lineMat = shared?.lines ?? basic(print.lines);
  const centreMat = basic(print.centre);

  const rimGeo = createTzaarRimGeometry();
  const fieldGeo = createTzaarFieldGeometry();
  const fillGeo = createTzaarCenterFillGeometry();
  const ringGeo = createTzaarCenterRingGeometry();
  const lineGeo = createTzaarBoardLineGeometry();
  boardGeometries?.push(rimGeo, fieldGeo, fillGeo, ringGeo, lineGeo);

  const rim = new THREE.Mesh(rimGeo, rimMat);
  const field = new THREE.Mesh(fieldGeo, fieldMat);
  const fill = new THREE.Mesh(fillGeo, centreMat);
  const ring = new THREE.Mesh(ringGeo, lineMat);
  const lines = new THREE.Mesh(lineGeo, lineMat);
  field.renderOrder = 1;
  fill.renderOrder = 2;
  ring.renderOrder = 3;
  lines.renderOrder = 3;
  group.add(rim, field, fill, ring, lines, createContactShadowBlob(TZAAR_BOARD_SIDE));
}

export function createTzaarBoardGroup(tokens: ThemeTokens): THREE.Group {
  const group = new THREE.Group();
  addTzaarBoardMeshes(group, tokens);
  return group;
}

export function createTzaarHexTopology(): Topology {
  const cells = tzaarPlayableCells();
  const pos = (index: number) => {
    const cell = cells[index];
    return cell ? tzaarWorldPosition(cell.x, cell.y) : new THREE.Vector3();
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
    buildBoard(ctx: BoardBuildContext) {
      addTzaarBoardMeshes(ctx.board, tzaarPrintColorsFromContext(ctx), ctx.boardGeometries, {
        field: ctx.boardMaterial,
        lines: ctx.gridMaterial,
      });
      return true;
    },
    frameCorners(_snapshot: BoardSnapshot) {
      const half = TZAAR_BOARD_SIDE / 2;
      return [
        new THREE.Vector3(-half, 0, -half),
        new THREE.Vector3(half, 0, -half),
        new THREE.Vector3(-half, 0, half),
        new THREE.Vector3(half, 0, half),
      ];
    },
  };
}

function tzaarPrintColorsFromContext(ctx: BoardBuildContext): ThemeTokens {
  const board = `#${ctx.boardMaterial.color.getHexString()}`;
  const lines = `#${ctx.gridMaterial.color.getHexString()}`;
  return {
    table: board,
    board,
    lines,
    win: '#3b82f6',
    ghostOpacity: 0.24,
    shadow: lines,
    piece: {},
  };
}
