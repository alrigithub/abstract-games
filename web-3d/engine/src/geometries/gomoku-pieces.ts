import * as THREE from 'three';
import { BOARD } from '../constants';
import type { PieceGeometrySet } from '../types';

export function createGomokuStoneGeometry(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.12, 0.0),
    new THREE.Vector2(0.38, 0.1),
    new THREE.Vector2(0.12, 0.2),
    new THREE.Vector2(0.0, 0.2),
  ];
  const geo = new THREE.LatheGeometry(profile, BOARD.RADIAL_SEGMENTS, 0, Math.PI * 2);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function gomokuPieceGeometrySet(geo: THREE.BufferGeometry): PieceGeometrySet {
  return {
    geometry: () => geo,
    height: () => 0.2,
    yaw: id => {
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
      return ((hash >>> 0) % 1000) / 1000 * (Math.PI / 8);
    },
  };
}
