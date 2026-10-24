import * as THREE from 'three';
import { BOARD } from '../constants';
import type { PieceGeometrySet } from '../types';
import { anchorGeometryBaseToY0 } from './anchor';

/** Alex sketch override: cat lathe crown; kitten plain cylinder (IMPLEMENTED.md). */
export function createBoopCatGeometry(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0.29, 0),
    new THREE.Vector2(0.34, 0.07),
    new THREE.Vector2(0.17, 0.36),
    new THREE.Vector2(0.17, 0.36),
  ];
  return anchorGeometryBaseToY0(new THREE.LatheGeometry(profile, 96, 0, Math.PI * 2));
}

export function createBoopKittenGeometry(): THREE.BufferGeometry {
  return anchorGeometryBaseToY0(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 48, 1, false));
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
