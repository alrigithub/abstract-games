import * as THREE from 'three';
import type { PieceGeometrySet, ThemeTokens } from '../types';
import {
  GIPF_CHIP,
  createGipfChipEdgeRingGeometry,
  createGipfChipGeometry,
  createGipfChipRimGeometry,
} from './gipf-set';
import { decoratePieceMesh } from './piece-outlines';
import type { TzaarKind } from './hex-board';

export const TZAAR_DISC_RADIUS = GIPF_CHIP.RADIUS;
export const TZAAR_DISC_HEIGHT = GIPF_CHIP.HEIGHT;

const SEGMENTS = 48;
const EMBLEM_LIFT = 0.01;
const EMBLEM_H = 0.007;
const RING_INNER = TZAAR_DISC_RADIUS * 0.46;
const RING_OUTER = TZAAR_DISC_RADIUS * 0.58;
const DOT_R = TZAAR_DISC_RADIUS * 0.12;
const SEPARATOR_INNER = TZAAR_DISC_RADIUS * 0.86;
const SEPARATOR_OUTER = TZAAR_DISC_RADIUS * 0.98;

export type TzaarEmblem = 'ring' | 'dot';

export function tzaarEmblemsFor(kind: TzaarKind): TzaarEmblem[] {
  if (kind === 'tzaar') return ['ring', 'dot'];
  if (kind === 'tzarra') return ['ring'];
  return [];
}

export function createTzaarDiscGeometry(): THREE.BufferGeometry {
  return createGipfChipGeometry();
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
const chipRimGeo = createGipfChipRimGeometry();
const ringGeo = createTzaarRingGeometry();
const dotGeo = createTzaarDotGeometry();
const separatorGeo = createTzaarSeparatorGeometry();
const topEdgeRingGeo = createGipfChipEdgeRingGeometry(GIPF_CHIP.HEIGHT / 2 - GIPF_CHIP.CHAMFER);
const bottomEdgeRingGeo = createGipfChipEdgeRingGeometry(-GIPF_CHIP.HEIGHT / 2 + GIPF_CHIP.CHAMFER);

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
  const rimFill = basic(palette.rim);
  const edge = new THREE.LineBasicMaterial({ color: palette.edge, transparent: true, opacity: 0.85 });
  const outline = basic(options.tokens.lines, { side: THREE.BackSide });
  const disc = decoratePieceMesh(new THREE.Mesh(discGeo, fill), edge, outline, options.edgeCache);
  const rim = decoratePieceMesh(new THREE.Mesh(chipRimGeo, rimFill), edge, outline, options.edgeCache);
  const edgeFill = basic(palette.edge);
  group.add(disc, rim, new THREE.Mesh(topEdgeRingGeo, edgeFill), new THREE.Mesh(bottomEdgeRingGeo, edgeFill));

  if (options.showSeparator) {
    const sep = decoratePieceMesh(
      new THREE.Mesh(separatorGeo, edgeFill),
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

/** Vertical pip column — one pip per disc — so stack height reads from ~45°. */
export function createTzaarHeightBadge(height: number, tokens: ThemeTokens, player: string): THREE.Group {
  const group = new THREE.Group();
  const palette = tokens.piece[player] ?? tokens.piece.A!;
  const fill = basic(palette.fill);
  const edge = new THREE.LineBasicMaterial({ color: palette.edge });
  const pipH = 0.04;
  const gap = 0.012;
  const radius = 0.055;
  for (let i = 0; i < height; i++) {
    const geo = new THREE.CylinderGeometry(radius, radius, pipH, 20);
    const mesh = new THREE.Mesh(geo, fill);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edge));
    mesh.position.y = i * (pipH + gap) + pipH / 2;
    group.add(mesh);
  }
  return group;
}
