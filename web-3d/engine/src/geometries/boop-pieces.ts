import * as THREE from 'three';
import { BOARD } from '../constants';
import type { PieceGeometrySet } from '../types';
import { anchorGeometryBaseToY0 } from './anchor';

/** Radial segments per IMPLEMENTED.md (Alex sketch override). */
const BOOP_CAT_RADIAL = 96;
const BOOP_KITTEN_RADIAL = 48;

/** Cat lathe crown: base r 0.29 → shoulder r 0.34 @ y 0.07 → flat top r 0.17, h 0.36; base on y = 0. */
export function createBoopCatGeometry(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.29, 0.0),
    new THREE.Vector2(0.34, 0.07),
    new THREE.Vector2(0.17, 0.36),
    new THREE.Vector2(0.0, 0.36),
  ];
  const geo = anchorGeometryBaseToY0(new THREE.LatheGeometry(profile, BOOP_CAT_RADIAL, 0, Math.PI * 2));
  geo.computeVertexNormals();
  return geo;
}

/** Kitten plain cylinder r 0.20, h 0.30; base on y = 0. */
export function createBoopKittenGeometry(): THREE.BufferGeometry {
  const geo = anchorGeometryBaseToY0(
    new THREE.CylinderGeometry(0.2, 0.2, 0.3, BOOP_KITTEN_RADIAL, 1, false),
  );
  geo.computeVertexNormals();
  return geo;
}

export function boopPieceGeometrySet(
  cat: THREE.BufferGeometry,
  kitten: THREE.BufferGeometry,
): PieceGeometrySet {
  const catHeight = cat.boundingBox!.max.y - cat.boundingBox!.min.y;
  const kittenHeight = kitten.boundingBox!.max.y - kitten.boundingBox!.min.y;
  return {
    geometry(piece) {
      return piece.shape === 'kitten' ? kitten : cat;
    },
    height(piece) {
      return piece.shape === 'kitten' ? kittenHeight : catHeight;
    },
    yaw: () => 0,
    edgeThreshold: BOARD.EDGE_THRESHOLD_BOOP,
  };
}

/** EdgesGeometry threshold for Boop lathe/cylinder silhouettes (three rim rings on cat). */
export const BOOP_EDGE_THRESHOLD = BOARD.EDGE_THRESHOLD_BOOP;
