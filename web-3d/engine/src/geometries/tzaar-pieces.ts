import * as THREE from 'three';
import type { PieceGeometrySet, ThemeTokens } from '../types';
import { decoratePieceMesh } from './piece-outlines';
import type { TzaarKind } from './hex-board';

export const TZAAR_DISC_RADIUS = 0.38;
export const TZAAR_DISC_HEIGHT = 0.12;

const SEGMENTS = 48;
const EMBLEM_LIFT = 0.01;
const EMBLEM_H = 0.007;
const RING_INNER = TZAAR_DISC_RADIUS * 0.46;
const RING_OUTER = TZAAR_DISC_RADIUS * 0.58;
const DOT_R = TZAAR_DISC_RADIUS * 0.12;
const SEPARATOR_INNER = TZAAR_DISC_RADIUS * 0.9;
const SEPARATOR_OUTER = TZAAR_DISC_RADIUS * 1.02;

export type TzaarEmblem = 'ring' | 'dot';

export function tzaarEmblemsFor(kind: TzaarKind): TzaarEmblem[] {
  if (kind === 'tzaar') return ['ring', 'dot'];
  if (kind === 'tzarra') return ['ring'];
  return [];
}

export function createTzaarDiscGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(TZAAR_DISC_RADIUS, TZAAR_DISC_RADIUS, TZAAR_DISC_HEIGHT, SEGMENTS, 1, false);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function annulus(inner: number, outer: number, height: number, y: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    steps: 1,
    curveSegments: SEGMENTS,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, 0);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function createTzaarRingGeometry(): THREE.BufferGeometry {
  return annulus(RING_INNER, RING_OUTER, EMBLEM_H, TZAAR_DISC_HEIGHT / 2 + EMBLEM_LIFT);
}

export function createTzaarDotGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(DOT_R, DOT_R, EMBLEM_H, SEGMENTS, 1, false);
  geo.translate(0, TZAAR_DISC_HEIGHT / 2 + EMBLEM_LIFT, 0);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function createTzaarSeparatorGeometry(): THREE.BufferGeometry {
  return annulus(SEPARATOR_INNER, SEPARATOR_OUTER, 0.006, -TZAAR_DISC_HEIGHT / 2);
}

const discGeo = createTzaarDiscGeometry();
const ringGeo = createTzaarRingGeometry();
const dotGeo = createTzaarDotGeometry();
const separatorGeo = createTzaarSeparatorGeometry();

export function tzaarPieceGeometrySet(): PieceGeometrySet {
  return {
    geometry: () => discGeo,
    height: () => TZAAR_DISC_HEIGHT,
    yaw: () => 0,
  };
}

function basic(color: string, extra?: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
}

export function createTzaarPieceMesh(options: {
  player: string;
  kind: TzaarKind;
  isTop: boolean;
  tokens: ThemeTokens;
  edgeCache: Map<THREE.BufferGeometry, THREE.EdgesGeometry>;
  showSeparator?: boolean;
}): THREE.Group {
  const group = new THREE.Group();
  const palette = options.tokens.piece[options.player] ?? options.tokens.piece.A!;
  const fill = basic(palette.fill);
  const edge = new THREE.LineBasicMaterial({ color: palette.edge, transparent: true, opacity: 0.85 });
  const outline = basic(options.tokens.lines, { side: THREE.BackSide });
  const disc = decoratePieceMesh(new THREE.Mesh(discGeo, fill), edge, outline, options.edgeCache);
  group.add(disc);

  if (options.showSeparator) {
    const sepFill = basic(palette.edge);
    const sep = decoratePieceMesh(
      new THREE.Mesh(separatorGeo, sepFill),
      edge,
      outline,
      options.edgeCache,
    );
    group.add(sep);
  }

  if (options.isTop) {
    const mark = basic(palette.edge);
    for (const emblem of tzaarEmblemsFor(options.kind)) {
      const geo = emblem === 'ring' ? ringGeo : dotGeo;
      group.add(decoratePieceMesh(new THREE.Mesh(geo, mark), edge, outline, options.edgeCache));
    }
  }
  return group;
}

const SEGMENT: Record<string, [number, number, number, number, number]> = {
  a: [0, 0.09, 0.1, 0.018, 0],
  b: [0.05, 0.045, 0.018, 0.08, 0],
  c: [0.05, -0.045, 0.018, 0.08, 0],
  d: [0, -0.09, 0.1, 0.018, 0],
  e: [-0.05, -0.045, 0.018, 0.08, 0],
  f: [-0.05, 0.045, 0.018, 0.08, 0],
  g: [0, 0, 0.1, 0.018, 0],
};

const DIGITS: Record<number, string[]> = {
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'c', 'd'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g'],
};

/** Small 7-segment stack-height badge, readable from the ~45° ortho view. */
export function createTzaarHeightBadge(height: number, tokens: ThemeTokens, player: string): THREE.Group {
  const group = new THREE.Group();
  const palette = tokens.piece[player] ?? tokens.piece.A!;
  const fill = basic(palette.edge);
  const plate = basic(palette.fill);
  const backing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.02), plate);
  group.add(backing);
  for (const key of DIGITS[height] ?? DIGITS[8]!) {
    const [x, y, w, h] = SEGMENT[key]!;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), fill);
    bar.position.set(x, y, 0.02);
    group.add(bar);
  }
  return group;
}
