import * as THREE from 'three';
import { BOARD } from '../constants';
import { createContactShadowBlob } from '../geometries/contact-shadow';
import { YINSH } from '../geometries/yinsh-pieces';
import type { BoardBuildContext, BoardSnapshot, Topology, YinshCoord } from '../types';

const BOARD_RADIUS_SQ = 4.6 * 4.6;
const SQRT3 = Math.sqrt(3);

/** Step along each of the three Yinsh line families (see `yinsh::Direction::AXES`). */
const SEGMENT_DIRS: readonly YinshCoord[] = [
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: 1 },
];

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
  coords.sort((a, b) => a.x - b.x || a.y - b.y);
  return coords;
}

export const YINSH_COORDS = allYinshCoords();

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

function addCoord(a: YinshCoord, b: YinshCoord): YinshCoord {
  return { x: a.x + b.x, y: a.y + b.y };
}

function convexHullXZ(points: THREE.Vector2[]): THREE.Vector2[] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: THREE.Vector2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: THREE.Vector2[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function expandPolygon(poly: THREE.Vector2[], margin: number): THREE.Vector2[] {
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  return poly.map(p => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return new THREE.Vector2(p.x + (dx / len) * margin, p.y + (dy / len) * margin);
  });
}

function boardOutlinePolygon(spacing: number): THREE.Vector2[] {
  const xz = YINSH_COORDS.map(c => {
    const p = yinshWorldPoint(c, spacing);
    return new THREE.Vector2(p.x, p.z);
  });
  const hull = convexHullXZ(xz);
  return expandPolygon(hull, YINSH.RING_OUTER * 0.35);
}

function nearestCoord(x: number, z: number, spacing: number = YINSH.SPACING): { coord: YinshCoord; distSq: number } {
  let best = YINSH_COORDS[0]!;
  let bestDist = Infinity;
  for (const coord of YINSH_COORDS) {
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

function drawYinshGridSegments(ctx: BoardBuildContext, spacing: number) {
  const inside = new Set(YINSH_COORDS.map(yinshCoordKey));
  const lineWidth = BOARD.LINE_W;
  const lineY = 0.006;
  const positions: number[] = [];
  const halfW = lineWidth * 0.5;

  const pushQuad = (a: THREE.Vector3, b: THREE.Vector3) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) return;
    const px = (-dz / len) * halfW;
    const pz = (dx / len) * halfW;
    const y = lineY;
    positions.push(
      a.x + px, y, a.z + pz,
      a.x - px, y, a.z - pz,
      b.x - px, y, b.z - pz,
      a.x + px, y, a.z + pz,
      b.x - px, y, b.z - pz,
      b.x + px, y, b.z + pz,
    );
  };

  for (const coord of YINSH_COORDS) {
    const a = yinshWorldPoint(coord, spacing);
    for (const dir of SEGMENT_DIRS) {
      const neighbor = addCoord(coord, dir);
      if (!inside.has(yinshCoordKey(neighbor))) continue;
      const b = yinshWorldPoint(neighbor, spacing);
      pushQuad(a, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  ctx.boardGeometries.push(geo);
  const grid = new THREE.Mesh(geo, ctx.gridMaterial);
  grid.renderOrder = 2;
  ctx.board.add(grid);
}

function buildYinshBoardSurface(ctx: BoardBuildContext, spacing: number) {
  ctx.gridMaterial.depthWrite = false;
  const outline = boardOutlinePolygon(spacing);
  const thin = BOARD.TAK_SLAB;
  const shape = new THREE.Shape();
  shape.moveTo(outline[0]!.x, outline[0]!.y);
  for (let i = 1; i < outline.length; i++) shape.lineTo(outline[i]!.x, outline[i]!.y);
  shape.closePath();
  const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: thin, bevelEnabled: false });
  slabGeo.rotateX(-Math.PI / 2);
  slabGeo.computeBoundingBox();
  const slabMaxY = slabGeo.boundingBox!.max.y;
  slabGeo.translate(0, -slabMaxY, 0);
  ctx.boardGeometries.push(slabGeo);
  const slabMesh = new THREE.Mesh(slabGeo, ctx.boardMaterial);
  ctx.board.add(slabMesh);
  const span = outline.reduce((m, p) => Math.max(m, Math.abs(p.x), Math.abs(p.y)), 0) * 2;
  ctx.board.add(createContactShadowBlob(span, thin));
  drawYinshGridSegments(ctx, spacing);
}

export interface YinshTopologyOptions {
  spacing?: number;
}

export function createYinshTopology(options: YinshTopologyOptions = {}): Topology {
  const spacing = options.spacing ?? YINSH.SPACING;
  const indexByKey = new Map(YINSH_COORDS.map((c, i) => [yinshCoordKey(c), i]));

  return {
    cellPosition(index, _snapshot) {
      const coord = YINSH_COORDS[index];
      return coord ? yinshWorldPoint(coord, spacing) : new THREE.Vector3();
    },
    cellAtWorld(x, z, _snapshot) {
      const { coord, distSq } = nearestCoord(x, z, spacing);
      const pickRadius = spacing * 0.38;
      if (distSq > pickRadius * pickRadius) return null;
      return indexByKey.get(yinshCoordKey(coord)) ?? null;
    },
    projectCell(index, _snapshot) {
      const coord = YINSH_COORDS[index];
      return coord ? yinshWorldPoint(coord, spacing) : new THREE.Vector3();
    },
    buildBoard(ctx) {
      buildYinshBoardSurface(ctx, spacing);
      return true;
    },
    frameCorners(snapshot: BoardSnapshot) {
      const points: THREE.Vector3[] = [];
      const margin = YINSH.RING_OUTER + spacing * 0.08;
      for (const p of boardOutlinePolygon(spacing)) {
        points.push(new THREE.Vector3(p.x, 0, p.y));
      }
      for (const coord of YINSH_COORDS) {
        const c = yinshWorldPoint(coord, spacing);
        points.push(new THREE.Vector3(c.x, 0, c.z));
      }
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
    const p = yinshWorldPoint(c, spacing);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, maxX, minZ, maxZ };
}

/** Side rack slot for scored rings (three per player). */
export function yinshRackPosition(player: 'A' | 'B', slot: number, spacing: number = YINSH.SPACING): { x: number; z: number } {
  const { minX, maxX } = yinshBoardExtents(spacing);
  const gap = YINSH.RING_OUTER * 1.35;
  const step = spacing * 0.82;
  const x = player === 'A' ? minX - gap : maxX + gap;
  return { x, z: (slot - 1) * step };
}

export function yinshIndex(coord: YinshCoord): number {
  return YINSH_COORDS.findIndex(c => c.x === coord.x && c.y === coord.y);
}
