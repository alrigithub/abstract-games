import * as THREE from 'three';
import { BOARD } from '../constants';
import type { BoardBuildContext, BoardSnapshot, ThemeTokens, Topology } from '../types';
import {
  GIPF_BOARD,
  createGipfHexBoard,
  createGipfLineGeometry,
  createGipfRegularHexSlabGeometry,
  gipfLayoutExtent,
  gipfLayoutFrameCorners,
  gipfPrintColors,
  gipfWorldPoint,
  tzaarLayout,
} from './gipf-set';

/** Official Waltz 9×9 template: `100` = hole or outside. ±1 Tott, ±2 Tzarra, ±3 Tzaar. */
export const TZAAR_TEMPLATE: readonly number[] = [
  -1, 1, 1, 1, 1, 100, 100, 100, 100, -1, -2, 2, 2, 2, -1, 100, 100, 100, -1, -2, -3, 3, 3, -2, -1, 100, 100, -1,
  -2, -3, -1, 1, -3, -2, -1, 100, 1, 2, 3, 1, 100, -1, -3, -2, -1, 100, 1, 2, 3, -1, 1, 3, 2, 1, 100, 100, 1, 2,
  -3, -3, 3, 2, 1, 100, 100, 100, 1, -2, -2, -2, 2, 1, 100, 100, 100, 100, -1, -1, -1, -1, 1,
];

export const TZAAR_GRID = 9;
export const TZAAR_CENTER = { x: 4, y: 4 } as const;
export const TZAAR_PITCH = 1;
export const TZAAR_BOARD_SIDE = gipfLayoutExtent(tzaarLayout());
export const TZAAR_RIM_W = GIPF_BOARD.RIM_W;
export const TZAAR_LINE_W = GIPF_BOARD.LINE_W;
export const TZAAR_CENTER_HEX = GIPF_BOARD.CENTER_HEX;

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
  return gipfWorldPoint(x - TZAAR_CENTER.x, y - TZAAR_CENTER.y, TZAAR_PITCH);
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

export function createTzaarBoardLineGeometry(lineW = TZAAR_LINE_W): THREE.BufferGeometry {
  return createGipfLineGeometry(tzaarLayout(), lineW);
}

/** Regular hex slab centred on the point centroid; top face at the playfield surface. */
export function createTzaarBoardSlabGeometry(slab = BOARD.SLAB): THREE.BufferGeometry {
  return createGipfRegularHexSlabGeometry(tzaarLayout(), slab);
}

export const tzaarPrintColors = gipfPrintColors;

export function tzaarBoardExtent(): number {
  return TZAAR_BOARD_SIDE;
}

export function createTzaarBoardGroup(tokens: ThemeTokens): THREE.Group {
  return createGipfHexBoard(tzaarLayout(), tokens);
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
      const built = createGipfHexBoard(tzaarLayout(), {
        table: `#${ctx.boardMaterial.color.getHexString()}`,
        board: `#${ctx.boardMaterial.color.getHexString()}`,
        lines: `#${ctx.gridMaterial.color.getHexString()}`,
        win: '#3b82f6',
        ghostOpacity: 0.24,
        shadow: `#${ctx.gridMaterial.color.getHexString()}`,
        piece: {},
      });
      while (built.children.length) ctx.board.add(built.children[0]!);
      return true;
    },
    frameCorners(_snapshot: BoardSnapshot) {
      return gipfLayoutFrameCorners(tzaarLayout());
    },
  };
}
