import * as THREE from 'three';
import {
  createGipfHexBoard,
  gipfPointKey,
  gipfWorldPoint,
  isYinshPlayfieldAxial,
  yinshLayout,
  type GipfHexLayout,
} from '../geometries/gipf-set';
import { YINSH } from '../geometries/yinsh-pieces';
import type { BoardBuildContext, BoardSnapshot, ThemeTokens, Topology, YinshCoord } from '../types';

const YINSH_HEX_LAYOUT: GipfHexLayout = yinshLayout(YINSH.SPACING);

/** Playable intersections in layout order (`q` → `x`, `r` → `y`). */
export const YINSH_COORDS: YinshCoord[] = YINSH_HEX_LAYOUT.points.map(p => ({ x: p.q, y: p.r }));

const INDEX_BY_KEY = new Map(YINSH_COORDS.map((c, i) => [yinshCoordKey(c), i]));

export function isYinshCoordInside(coord: YinshCoord): boolean {
  return INDEX_BY_KEY.has(yinshCoordKey(coord));
}

export function yinshCoordKey(coord: YinshCoord): string {
  return gipfPointKey(coord.x, coord.y);
}

/** World position of a playable intersection — same mapping as printed grid lines. */
export function yinshWorldPoint(coord: YinshCoord, spacing: number = YINSH.SPACING): THREE.Vector3 {
  return gipfWorldPoint(coord.x, coord.y, spacing);
}

export function isYinshPlayfieldCoord(coord: YinshCoord): boolean {
  return isYinshPlayfieldAxial(coord.x, coord.y);
}

function tokensFromBoardContext(ctx: BoardBuildContext): ThemeTokens {
  return {
    table: `#${ctx.boardMaterial.color.getHexString()}`,
    board: `#${ctx.boardMaterial.color.getHexString()}`,
    lines: `#${ctx.gridMaterial.color.getHexString()}`,
    win: '#3b82f6',
    ghostOpacity: 0.24,
    shadow: `#${ctx.gridMaterial.color.getHexString()}`,
    piece: {},
  };
}

function nearestIndex(x: number, z: number, spacing: number): { index: number; distSq: number } {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < YINSH_COORDS.length; i++) {
    const p = yinshWorldPoint(YINSH_COORDS[i]!, spacing);
    const dx = p.x - x;
    const dz = p.z - z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDist) {
      bestDist = distSq;
      best = i;
    }
  }
  return { index: best, distSq: bestDist };
}

export interface YinshTopologyOptions {
  spacing?: number;
}

export function createYinshTopology(options: YinshTopologyOptions = {}): Topology {
  const spacing = options.spacing ?? YINSH.SPACING;
  const layout = spacing === YINSH.SPACING ? YINSH_HEX_LAYOUT : yinshLayout(spacing);

  return {
    cellPosition(index, _snapshot) {
      const coord = YINSH_COORDS[index];
      return coord ? gipfWorldPoint(coord.x, coord.y, spacing) : new THREE.Vector3();
    },
    cellAtWorld(x, z, _snapshot) {
      const { index, distSq } = nearestIndex(x, z, spacing);
      const pickRadius = spacing * 0.38;
      if (distSq > pickRadius * pickRadius) return null;
      return index;
    },
    projectCell(index, _snapshot) {
      const coord = YINSH_COORDS[index];
      return coord ? gipfWorldPoint(coord.x, coord.y, spacing) : new THREE.Vector3();
    },
    buildBoard(ctx) {
      const built = createGipfHexBoard(layout, tokensFromBoardContext(ctx));
      while (built.children.length) ctx.board.add(built.children[0]!);
      return true;
    },
    frameCorners(snapshot: BoardSnapshot) {
      const points: THREE.Vector3[] = [];
      for (const p of layout.points) {
        points.push(p.world.clone());
      }
      const margin = YINSH.RING_OUTER + spacing * 0.08;
      for (const slot of snapshot.reserves ?? []) {
        if (slot.count <= 0) continue;
        const { x, z } = slot.position;
        const pad = margin * 1.35;
        points.push(
          new THREE.Vector3(x - pad, 0, z - pad),
          new THREE.Vector3(x + pad, 0, z + pad),
          new THREE.Vector3(x, YINSH.RING_HEIGHT, z),
        );
      }
      return points;
    },
  };
}

export function yinshBoardExtents(spacing: number = YINSH.SPACING): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const c of YINSH_COORDS) {
    const p = gipfWorldPoint(c.x, c.y, spacing);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, maxX, minZ, maxZ };
}

/** Side rack slots for scored rings — off the playfield, not on hex intersections. */
export function yinshRackPosition(player: 'A' | 'B', slot: number, spacing: number = YINSH.SPACING): { x: number; z: number } {
  const { minX, maxX } = yinshBoardExtents(spacing);
  const padX = spacing * 1.55 + YINSH.RING_OUTER * 2.6;
  const step = spacing * 0.82;
  const x = player === 'A' ? minX - padX : maxX + padX;
  const z = (slot - 1) * step;
  return { x, z };
}

export function yinshIndex(coord: YinshCoord): number {
  return INDEX_BY_KEY.get(yinshCoordKey(coord)) ?? -1;
}
