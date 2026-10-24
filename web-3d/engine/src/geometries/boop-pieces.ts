import * as THREE from 'three';
import { BOARD } from '../constants';
import type { PieceGeometrySet } from '../types';

/** Alex sketch override: cat lathe crown; kitten plain cylinder (IMPLEMENTED.md). */
export function createBoopCatGeometry(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0.29, 0),
    new THREE.Vector2(0.34, 0.07),
    new THREE.Vector2(0.17, 0.36),
    new THREE.Vector2(0.17, 0.36),
  ];
  const geo = new THREE.LatheGeometry(profile, 96, 0, Math.PI * 2);
  geo.computeBoundingBox();
  return geo;
}

export function createBoopKittenGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 48, 1, false);
  geo.computeBoundingBox();
  return geo;
}

export function boopPieceGeometrySet(
  cat: THREE.BufferGeometry,
  kitten: THREE.BufferGeometry,
): PieceGeometrySet {
  return {
    geometry(piece) {
      return piece.shape === 'kitten' ? kitten : cat;
    },
    height(piece) {
      const geo = piece.shape === 'kitten' ? kitten : cat;
      const box = geo.boundingBox!;
      return box.max.y - box.min.y;
    },
    yaw: () => 0,
  };
}
