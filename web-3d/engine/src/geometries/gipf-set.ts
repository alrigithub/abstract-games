import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOARD } from '../constants';
import type { ThemeTokens } from '../types';
import { createContactShadowBlob } from './contact-shadow';

/**
 * Shared GIPF Project chip (Tzaar discs / Yinsh markers).
 * Physical set: ~30 mm dia × 5–6 mm thick on ~40–46 mm intersection spacing
 * (Yinsh cardboard pitch 46.4 mm; Tzaar pieces sit similarly on a tighter hex).
 * World units assume spacing = 1.
 */
export const GIPF_CHIP = {
  RADIUS: 0.36,
  HEIGHT: 0.13,
  CHAMFER: 0.022,
  RIM_INNER: 0.27,
  RIM_OUTER: 0.335,
  SEGMENTS: 24,
} as const;

/** Shared printed-hex board treatment for the GIPF set. */
export const GIPF_BOARD = {
  SLAB: BOARD.SLAB,
  LINE_W: 0.02,
  RIM_W: 0.09,
  MARGIN: 1.4,
  CENTER_HEX: 0.52,
} as const;

export const GIPF_SPACING = 1;
const SQRT3_2 = Math.sqrt(3) / 2;
const YINSH_RADIUS_SQ = 4.6 * 4.6;

/** Axial steps that are true neighbours of {@link gipfWorldPoint}. */
export const GIPF_AXIAL_STEPS = [
  [1, 0],
  [0, 1],
  [1, 1],
] as const;

export interface GipfPoint {
  q: number;
  r: number;
  world: THREE.Vector3;
}

export interface GipfHexLayout {
  id: 'tzaar' | 'yinsh';
  spacing: number;
  points: GipfPoint[];
  slab: 'square' | 'hex';
  margin: number;
  centreMotif: boolean;
  emptyCentre: boolean;
}

/** Pointy-top triangular lattice. Shared by Tzaar and Yinsh points + pieces. */
export function gipfWorldPoint(q: number, r: number, spacing: number = GIPF_SPACING): THREE.Vector3 {
  return new THREE.Vector3(spacing * SQRT3_2 * q, BOARD.PLAYFIELD_SURFACE_Y, spacing * (0.5 * q - r));
}

function pointAt(q: number, r: number, spacing: number): GipfPoint {
  return { q, r, world: gipfWorldPoint(q, r, spacing) };
}

/** Official Tzaar: cube-style hex of radius 4 minus the empty centre (60 points). */
export function tzaarLayout(spacing: number = GIPF_SPACING): GipfHexLayout {
  const points: GipfPoint[] = [];
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q - r)) > 4) continue;
      if (q === 0 && r === 0) continue;
      points.push(pointAt(q, r, spacing));
    }
  }
  return {
    id: 'tzaar',
    spacing,
    points,
    slab: 'square',
    margin: GIPF_BOARD.MARGIN * spacing,
    centreMotif: true,
    emptyCentre: true,
  };
}

/** Official Yinsh: 85-point hex with clipped corners (radius-5 disc, R² ≤ 4.6²). */
export function yinshLayout(spacing: number = GIPF_SPACING): GipfHexLayout {
  const points: GipfPoint[] = [];
  for (let q = -5; q <= 5; q++) {
    for (let r = -5; r <= 5; r++) {
      const x = SQRT3_2 * q;
      const z = 0.5 * q - r;
      if (x * x + z * z > YINSH_RADIUS_SQ) continue;
      points.push(pointAt(q, r, spacing));
    }
  }
  return {
    id: 'yinsh',
    spacing,
    points,
    slab: 'hex',
    margin: GIPF_BOARD.MARGIN * spacing,
    centreMotif: false,
    emptyCentre: false,
  };
}

export function gipfPointKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function gipfNeighborPairs(layout: GipfHexLayout): [GipfPoint, GipfPoint][] {
  const index = new Map(layout.points.map(p => [gipfPointKey(p.q, p.r), p]));
  const pairs: [GipfPoint, GipfPoint][] = [];
  for (const point of layout.points) {
    for (const [dq, dr] of GIPF_AXIAL_STEPS) {
      const next = index.get(gipfPointKey(point.q + dq, point.r + dr));
      if (next) pairs.push([point, next]);
    }
  }
  return pairs;
}

export function gipfLayoutExtent(layout: GipfHexLayout): number {
  let maxAbs = 0;
  for (const p of layout.points) {
    maxAbs = Math.max(maxAbs, Math.abs(p.world.x), Math.abs(p.world.z));
  }
  return 2 * (maxAbs + layout.margin);
}

export function gipfLayoutFrameCorners(layout: GipfHexLayout): THREE.Vector3[] {
  const half = gipfLayoutExtent(layout) / 2;
  return [
    new THREE.Vector3(-half, 0, -half),
    new THREE.Vector3(half, 0, -half),
    new THREE.Vector3(-half, 0, half),
    new THREE.Vector3(half, 0, half),
  ];
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return 1;
  return (((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255)) / 765;
}

export function gipfPrintColors(tokens: ThemeTokens): { field: string; rim: string; lines: string; centre: string } {
  const dark = luminance(tokens.board) < 0.45;
  return {
    field: tokens.board,
    rim: dark ? '#07080a' : '#1b1916',
    lines: tokens.lines,
    centre: dark ? '#2c3038' : '#c9c2b6',
  };
}

function basic(color: string, extra?: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false, ...extra });
}

export function gipfChipMaterials(tokens: ThemeTokens): Record<string, { fill: THREE.MeshBasicMaterial; rim: THREE.MeshBasicMaterial }> {
  const out: Record<string, { fill: THREE.MeshBasicMaterial; rim: THREE.MeshBasicMaterial }> = {};
  for (const player of Object.keys(tokens.piece)) {
    const palette = tokens.piece[player]!;
    out[player] = { fill: basic(palette.fill), rim: basic(palette.rim) };
  }
  return out;
}

/** Low-poly lathe poker-chip: flat faces, small edge chamfer. */
export function createGipfChipGeometry(): THREE.BufferGeometry {
  const h = GIPF_CHIP.HEIGHT / 2;
  const r = GIPF_CHIP.RADIUS;
  const c = GIPF_CHIP.CHAMFER;
  const profile = [
    new THREE.Vector2(0, -h),
    new THREE.Vector2(r - c, -h),
    new THREE.Vector2(r, -h + c),
    new THREE.Vector2(r, h - c),
    new THREE.Vector2(r - c, h),
    new THREE.Vector2(0, h),
  ];
  const geo = new THREE.LatheGeometry(profile, GIPF_CHIP.SEGMENTS);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function createGipfChipRimGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, GIPF_CHIP.RIM_OUTER, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, GIPF_CHIP.RIM_INNER, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.006,
    bevelEnabled: false,
    steps: 1,
    curveSegments: GIPF_CHIP.SEGMENTS,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, GIPF_CHIP.HEIGHT / 2 + 0.002, 0);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
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

function convexHullXZ(points: { x: number; z: number }[]): { x: number; z: number }[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  if (pts.length <= 2) return pts;
  const cross = (o: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) =>
    (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower: { x: number; z: number }[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: { x: number; z: number }[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function expandFromOrigin(points: { x: number; z: number }[], margin: number): { x: number; z: number }[] {
  return points.map(p => {
    const len = Math.hypot(p.x, p.z) || 1;
    const s = (len + margin) / len;
    return { x: p.x * s, z: p.z * s };
  });
}

function extrudeOutline(points: { x: number; z: number }[], slab: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const first = points[0]!;
  shape.moveTo(first.x, first.z);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i]!.x, points[i]!.z);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: slab, bevelEnabled: false, steps: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const top = geo.boundingBox?.max.y ?? slab;
  geo.translate(0, -top, 0);
  geo.computeBoundingBox();
  return geo;
}

function createSquareSlab(side: number, slab: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(side, slab, side);
  geo.translate(0, -slab / 2, 0);
  geo.computeBoundingBox();
  return geo;
}

function createCenterFillGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.004, 6);
  geo.rotateY(Math.PI / 6);
  geo.translate(0, 0.003, 0);
  geo.computeBoundingBox();
  return geo;
}

function createCenterRingGeometry(lineW: number): THREE.BufferGeometry {
  const verts: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    verts.push(new THREE.Vector3(Math.cos(a) * GIPF_BOARD.CENTER_HEX, 0, Math.sin(a) * GIPF_BOARD.CENTER_HEX));
  }
  const geos = verts.map((from, i) => linePlane(from, verts[(i + 1) % verts.length]!, lineW));
  const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry();
  for (const geo of geos) geo.dispose();
  return merged;
}

export function createGipfLineGeometry(layout: GipfHexLayout, lineW = GIPF_BOARD.LINE_W): THREE.BufferGeometry {
  const geos = gipfNeighborPairs(layout).map(([a, b]) => linePlane(a.world, b.world, lineW));
  const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry();
  for (const geo of geos) geo.dispose();
  merged.computeBoundingBox();
  return merged;
}

/** One printed GIPF hex board: shared slab / rim / line weight, layout chooses the outline. */
export function createGipfHexBoard(layout: GipfHexLayout, tokens: ThemeTokens): THREE.Group {
  const group = new THREE.Group();
  const print = gipfPrintColors(tokens);
  const slab = GIPF_BOARD.SLAB;
  const rimW = GIPF_BOARD.RIM_W * layout.spacing;
  const extent = gipfLayoutExtent(layout);

  let rimGeo: THREE.BufferGeometry;
  let fieldGeo: THREE.BufferGeometry;
  if (layout.slab === 'square') {
    rimGeo = createSquareSlab(extent, slab);
    fieldGeo = createSquareSlab(extent - 2 * rimW, slab);
    fieldGeo.translate(0, 0.001, 0);
  } else {
    const hull = expandFromOrigin(
      convexHullXZ(layout.points.map(p => ({ x: p.world.x, z: p.world.z }))),
      layout.margin,
    );
    const inner = expandFromOrigin(hull, -rimW);
    rimGeo = extrudeOutline(hull, slab);
    fieldGeo = extrudeOutline(inner.length ? inner : hull, slab);
    fieldGeo.translate(0, 0.001, 0);
  }

  const rim = new THREE.Mesh(rimGeo, basic(print.rim));
  const field = new THREE.Mesh(fieldGeo, basic(print.field));
  const lines = new THREE.Mesh(createGipfLineGeometry(layout), basic(print.lines));
  field.renderOrder = 1;
  lines.renderOrder = 3;
  group.add(rim, field, lines);

  if (layout.centreMotif) {
    const fill = new THREE.Mesh(createCenterFillGeometry(), basic(print.centre));
    const ring = new THREE.Mesh(createCenterRingGeometry(GIPF_BOARD.LINE_W), basic(print.lines));
    fill.renderOrder = 2;
    ring.renderOrder = 3;
    group.add(fill, ring);
  }

  group.add(createContactShadowBlob(extent, slab));
  return group;
}
