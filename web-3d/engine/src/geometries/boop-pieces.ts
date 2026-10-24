import * as THREE from 'three';
import { ANIMATION, BOARD } from '../constants';
import type { PieceGeometrySet } from '../types';

/** Radial segments per IMPLEMENTED.md (Alex sketch override). */
const BOOP_CAT_RADIAL = 96;
const BOOP_KITTEN_RADIAL = 48;

/** Engine stacks at ANIMATION.FLOOR; contact shadows sit at BOARD.SHADOW_Y — align bases to that plane. */
export const BOOP_SEAT_OFFSET = BOARD.SHADOW_Y - ANIMATION.FLOOR;

function seatOnBed(geo: THREE.BufferGeometry): void {
  geo.translate(0, BOOP_SEAT_OFFSET, 0);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}

/** Cat lathe crown: base r 0.29 → shoulder r 0.34 @ y 0.07 → flat top r 0.17, h 0.36; base on y = 0. */
export function createBoopCatGeometry(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.29, 0.0),
    new THREE.Vector2(0.34, 0.07),
    new THREE.Vector2(0.17, 0.36),
    new THREE.Vector2(0.0, 0.36),
  ];
  const geo = new THREE.LatheGeometry(profile, BOOP_CAT_RADIAL, 0, Math.PI * 2);
  seatOnBed(geo);
  return geo;
}

/** Kitten plain cylinder r 0.20, h 0.30; base on y = 0. */
export function createBoopKittenGeometry(): THREE.BufferGeometry {
  const radius = 0.2;
  const height = 0.3;
  const geo = new THREE.CylinderGeometry(radius, radius, height, BOOP_KITTEN_RADIAL, 1, false);
  geo.translate(0, height / 2, 0);
  seatOnBed(geo);
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
  };
}

/** EdgesGeometry threshold for Boop lathe/cylinder silhouettes (three rim rings on cat). */
export const BOOP_EDGE_THRESHOLD = BOARD.EDGE_THRESHOLD_BOOP;

/** Contact shadow sits at BOARD.SHADOW_Y; piece base at y = 0 after bed clearance. */
export const BOOP_SHADOW_Y = BOARD.SHADOW_Y;
