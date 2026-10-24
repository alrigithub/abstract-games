import * as THREE from 'three';
import { BOARD } from '../constants';
import { createContactShadowBlob } from '../geometries/contact-shadow';
import { YINSH } from '../geometries/yinsh-pieces';
import type { BoardBuildContext, BoardSnapshot, Topology, YinshCoord } from '../types';

const BOARD_RADIUS_SQ = 4.6 * 4.6;
const SQRT3 = Math.sqrt(3);

export function isYinshCoordInside(coord: YinshCoord): boolean {
  const x = coord.x;
  const y = coord.y;
  return (0.5 * SQRT3 * x) ** 2 + (0.5 * x - y) ** 2 <= BOARD_RADIUS_SQ;
}

export function allYinshCoords(): YinshCoord[] {
  const coords: YinshCoord[] = [];
  for (let x = -5; x <= 5; x++) {
    for (let y = -5; y <= 5; y++) {
      const coord = { x, y };
      if (isYinshCoordInside(coord)) coords.push(coord);
    }
  }
  return coords;
}

export function yinshCoordKey(coord: YinshCoord): string {
  return `${coord.x},${coord.y}`;
}

export function yinshWorldPoint(coord: YinshCoord, spacing: number = YINSH.SPACING): THREE.Vector3 {
  return new THREE.Vector3(
    spacing * (0.5 * SQRT3 * coord.x),
    0,
    spacing * (-coord.y + 0.5 * coord.x),
  );
}

function nearestCoord(x: number, z: number, spacing: number = YINSH.SPACING): { coord: YinshCoord; distSq: number } {
  const coords = allYinshCoords();
  let best = coords[0]!;
  let bestDist = Infinity;
  for (const coord of coords) {
    const p = yinshWorldPoint(coord, spacing);
    const dx = p.x - x;
    const dz = p.z - z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDist) {
      bestDist = distSq;
      best = coord;
    }
  }
  return { coord: best, distSq: bestDist };
}

function drawHexLines(ctx: BoardBuildContext, spacing: number) {
  const lineWidth = BOARD.LINE_W;
  const addLine = (start: THREE.Vector3, end: THREE.Vector3) => {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz) + lineWidth;
    const geo = new THREE.PlaneGeometry(lineWidth, length);
    ctx.boardGeometries.push(geo);
    const line = new THREE.Mesh(geo, ctx.gridMaterial);
    line.rotation.x = -Math.PI / 2;
    line.rotation.y = Math.atan2(dx, dz);
    line.position.set((start.x + end.x) / 2, 0.002, (start.z + end.z) / 2);
    ctx.board.add(line);
  };

  for (let x = -5; x <= 5; x++) {
    const coords = allYinshCoords().filter(c => c.x === x);
    if (!coords.length) continue;
    const minY = Math.min(...coords.map(c => c.y));
    const maxY = Math.max(...coords.map(c => c.y));
    addLine(yinshWorldPoint({ x, y: minY }, spacing), yinshWorldPoint({ x, y: maxY }, spacing));
  }
  for (let y = -5; y <= 5; y++) {
    const coords = allYinshCoords().filter(c => c.y === y);
    if (!coords.length) continue;
    const minX = Math.min(...coords.map(c => c.x));
    const maxX = Math.max(...coords.map(c => c.x));
    addLine(yinshWorldPoint({ x: minX, y }, spacing), yinshWorldPoint({ x: maxX, y }, spacing));
  }
  for (let d = -5; d <= 5; d++) {
    const coords = allYinshCoords().filter(c => c.y === c.x + d);
    if (!coords.length) continue;
    const minX = Math.min(...coords.map(c => c.x));
    const maxX = Math.max(...coords.map(c => c.x));
    addLine(
      yinshWorldPoint({ x: minX, y: minX + d }, spacing),
      yinshWorldPoint({ x: maxX, y: maxX + d }, spacing),
    );
  }
}

function buildYinshBoardSurface(ctx: BoardBuildContext, spacing: number) {
  const extent = spacing * 5.65;
  const thin = 0.028;
  const slab = new THREE.CylinderGeometry(extent, extent, thin, 6, 1);
  ctx.boardGeometries.push(slab);
  const slabMesh = new THREE.Mesh(slab, ctx.boardMaterial);
  slabMesh.position.y = -thin / 2;
  ctx.board.add(slabMesh);
  ctx.board.add(createContactShadowBlob(extent * 2));
  drawHexLines(ctx, spacing);
}

export interface YinshTopologyOptions {
  spacing?: number;
}

export function createYinshTopology(options: YinshTopologyOptions = {}): Topology {
  const spacing = options.spacing ?? YINSH.SPACING;
  const coords = allYinshCoords();
  const indexByKey = new Map(coords.map((c, i) => [yinshCoordKey(c), i]));

  return {
    cellPosition(index, _snapshot) {
      const coord = coords[index];
      return coord ? yinshWorldPoint(coord, spacing) : new THREE.Vector3();
    },
    cellAtWorld(x, z, _snapshot) {
      const { coord, distSq } = nearestCoord(x, z, spacing);
      const pickRadius = spacing * 0.42;
      if (distSq > pickRadius * pickRadius) return null;
      return indexByKey.get(yinshCoordKey(coord)) ?? null;
    },
    projectCell(index, _snapshot) {
      const coord = coords[index];
      return coord ? yinshWorldPoint(coord, spacing) : new THREE.Vector3();
    },
    buildBoard(ctx) {
      buildYinshBoardSurface(ctx, spacing);
      return true;
    },
    frameCorners(_snapshot: BoardSnapshot) {
      const points: THREE.Vector3[] = [];
      const margin = spacing * 0.55;
      for (const coord of coords) {
        const p = yinshWorldPoint(coord, spacing);
        points.push(new THREE.Vector3(p.x - margin, 0, p.z - margin));
        points.push(new THREE.Vector3(p.x + margin, 0, p.z + margin));
      }
      const rackX = extentRackX(spacing);
      for (const side of [-1, 1]) {
        for (let slot = 0; slot < 3; slot++) {
          const z = spacing * (slot - 1) * 0.85;
          points.push(new THREE.Vector3(side * rackX, 0, z));
        }
      }
      return points;
    },
  };
}

function extentRackX(spacing: number): number {
  const coords = allYinshCoords();
  let maxX = 0;
  for (const c of coords) maxX = Math.max(maxX, Math.abs(yinshWorldPoint(c, spacing).x));
  return maxX + spacing * 1.15;
}

/** Side rack slot for scored rings (three per player), matching Bevy Yinsh GUI layout. */
export function yinshRackPosition(player: 'A' | 'B', slot: number, spacing: number = YINSH.SPACING): { x: number; z: number } {
  const rackX = extentRackX(spacing);
  const step = spacing * 0.85;
  const side = player === 'A' ? -1 : 1;
  return { x: side * rackX, z: (slot - 1) * step };
}

export function yinshIndex(coord: YinshCoord): number {
  return allYinshCoords().findIndex(c => c.x === coord.x && c.y === coord.y);
}
