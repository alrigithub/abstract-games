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
  /** Diameter = 0.75 × spacing so gaps and printed lines show between neighbours. */
  RADIUS: 0.375,
  HEIGHT: 0.13,
  CHAMFER: 0.022,
  RIM_INNER: 0.336,
  RIM_OUTER: 0.368,
  /** Tube sits inside RADIUS so the rendered disc diameter stays 0.75 × spacing. */
  EDGE_TUBE: 0.012,
  SEGMENTS: 24,
} as const;

/** Shared printed-hex board treatment for the GIPF set. */
export const GIPF_BOARD = {
  SLAB: BOARD.SLAB,
  /** Printed line weight — readable at default ortho zoom on a 1280px viewport. */
  LINE_W: 0.044,
  RIM_W: 0.09,
  /** Yinsh hull pad. Tzaar uses {@link GIPF_BOARD.HEX_MARGIN} on a regular hex. */
  MARGIN: 1.4,
  /** Perpendicular margin outside the outer point ring (regular-hex slab). */
  HEX_MARGIN: 0.6,
  CENTER_HEX: 0.52,
  CENTER_HEX_INNER: 0.28,
} as const;

export const GIPF_SPACING = 1;
const SQRT3_2 = Math.sqrt(3) / 2;
const YINSH_RADIUS_SQ = 4.6 * 4.6;

export function isYinshPlayfieldAxial(q: number, r: number): boolean {
  const x = SQRT3_2 * q;
  const z = 0.5 * q - r;
  return x * x + z * z <= YINSH_RADIUS_SQ + 1e-9;
}

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
  /** `hex` = convex hull (Yinsh). `regular-hex` = regular hex centred on the point centroid. */
  slab: 'square' | 'hex' | 'regular-hex';
  margin: number;
  centreMotif: boolean;
  emptyCentre: boolean;
}

export interface GipfRegularHexSlab {
  center: { x: number; z: number };
  pointApothem: number;
  apothem: number;
  circumradius: number;
  margin: number;
  vertices: { x: number; z: number }[];
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
    slab: 'regular-hex',
    margin: GIPF_BOARD.HEX_MARGIN * spacing,
    centreMotif: true,
    emptyCentre: true,
  };
}

/** Official Yinsh: 85-point hex with clipped corners (radius-5 disc, R² ≤ 4.6²). */
export function yinshLayout(spacing: number = GIPF_SPACING): GipfHexLayout {
  const points: GipfPoint[] = [];
  for (let q = -5; q <= 5; q++) {
    for (let r = -5; r <= 5; r++) {
      if (!isYinshPlayfieldAxial(q, r)) continue;
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

export function gipfPointCentroid(layout: GipfHexLayout): { x: number; z: number } {
  let x = 0;
  let z = 0;
  for (const p of layout.points) {
    x += p.world.x;
    z += p.world.z;
  }
  const n = layout.points.length || 1;
  return { x: x / n, z: z / n };
}

/**
 * Outward unit normals of a pointy-top regular hex (flats at 60° + n·60°).
 * Matches {@link gipfWorldPoint} corners at 30° + n·60°.
 */
export function gipfHexEdgeNormals(): { x: number; z: number }[] {
  const normals: { x: number; z: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 + (i * Math.PI) / 3;
    normals.push({ x: Math.cos(a), z: Math.sin(a) });
  }
  return normals;
}

export function gipfHexDistanceToNearestEdge(
  x: number,
  z: number,
  center: { x: number; z: number },
  apothem: number,
): number {
  const px = x - center.x;
  const pz = z - center.z;
  let maxDot = -Infinity;
  for (const n of gipfHexEdgeNormals()) {
    maxDot = Math.max(maxDot, px * n.x + pz * n.z);
  }
  return apothem - maxDot;
}

/** Regular hex slab: same orientation as the outer point ring, even perpendicular margin. */
export function gipfRegularHexSlab(layout: GipfHexLayout): GipfRegularHexSlab {
  const center = gipfPointCentroid(layout);
  const normals = gipfHexEdgeNormals();
  let pointApothem = 0;
  for (const p of layout.points) {
    for (const n of normals) {
      pointApothem = Math.max(pointApothem, (p.world.x - center.x) * n.x + (p.world.z - center.z) * n.z);
    }
  }
  const margin = layout.margin;
  const apothem = pointApothem + margin;
  const circumradius = apothem / Math.cos(Math.PI / 6);
  const vertices: { x: number; z: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    vertices.push({
      x: center.x + circumradius * Math.cos(a),
      z: center.z + circumradius * Math.sin(a),
    });
  }
  return { center, pointApothem, apothem, circumradius, margin, vertices };
}

export function gipfLayoutExtent(layout: GipfHexLayout): number {
  if (layout.slab === 'regular-hex') {
    return 2 * gipfRegularHexSlab(layout).circumradius;
  }
  let maxAbs = 0;
  for (const p of layout.points) {
    maxAbs = Math.max(maxAbs, Math.abs(p.world.x), Math.abs(p.world.z));
  }
  return 2 * (maxAbs + layout.margin);
}

export function gipfLayoutFrameCorners(layout: GipfHexLayout): THREE.Vector3[] {
  if (layout.slab === 'regular-hex') {
    return gipfRegularHexSlab(layout).vertices.map(v => new THREE.Vector3(v.x, 0, v.z));
  }
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
    rim: dark ? '#07080a' : '#141210',
    lines: dark ? '#d4d8e0' : '#141210',
    centre: dark ? '#2a2e36' : '#d2cdc4',
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

/** Contrasting torus at a chip lip so stacked layers read as separate discs. */
export function createGipfChipEdgeRingGeometry(y: number): THREE.BufferGeometry {
  const geo = new THREE.TorusGeometry(
    GIPF_CHIP.RADIUS - GIPF_CHIP.EDGE_TUBE,
    GIPF_CHIP.EDGE_TUBE,
    10,
    GIPF_CHIP.SEGMENTS,
  );
  geo.rotateX(Math.PI / 2);
  geo.translate(0, y, 0);
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
  geo.translate((from.x + to.x) / 2, 0.0035, (from.z + to.z) / 2);
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

function createRegularHexCylinder(circumradius: number, slab: number, center: { x: number; z: number }): THREE.BufferGeometry {
  // CylinderGeometry(…, 6) already places vertices at 30°+n·60° (x=r sin θ, z=r cos θ).
  const geo = new THREE.CylinderGeometry(circumradius, circumradius, slab, 6);
  geo.translate(center.x, -slab / 2, center.z);
  geo.computeBoundingBox();
  return geo;
}

export function createGipfRegularHexSlabGeometry(layout: GipfHexLayout, slab = GIPF_BOARD.SLAB): THREE.BufferGeometry {
  const hex = gipfRegularHexSlab(layout);
  return createRegularHexCylinder(hex.circumradius, slab, hex.center);
}

function hexRingVerts(radius: number): THREE.Vector3[] {
  const verts: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    verts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return verts;
}

function createCenterFillGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(GIPF_BOARD.CENTER_HEX * 0.88, GIPF_BOARD.CENTER_HEX * 0.88, 0.004, 6);
  geo.translate(0, 0.003, 0);
  geo.computeBoundingBox();
  return geo;
}

function createCenterRingGeometry(radius: number, lineW: number): THREE.BufferGeometry {
  const verts = hexRingVerts(radius);
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
  } else if (layout.slab === 'regular-hex') {
    const hex = gipfRegularHexSlab(layout);
    const innerApothem = Math.max(hex.apothem - rimW, hex.pointApothem * 0.5);
    const innerR = innerApothem / Math.cos(Math.PI / 6);
    rimGeo = createRegularHexCylinder(hex.circumradius, slab, hex.center);
    fieldGeo = createRegularHexCylinder(innerR, slab, hex.center);
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
    const ring = new THREE.Mesh(createCenterRingGeometry(GIPF_BOARD.CENTER_HEX, GIPF_BOARD.LINE_W), basic(print.lines));
    const inner = new THREE.Mesh(
      createCenterRingGeometry(GIPF_BOARD.CENTER_HEX_INNER, GIPF_BOARD.LINE_W * 0.85),
      basic(print.lines),
    );
    fill.renderOrder = 2;
    ring.renderOrder = 3;
    inner.renderOrder = 3;
    group.add(fill, ring, inner);
  }

  group.add(createContactShadowBlob(extent, slab));
  return group;
}
