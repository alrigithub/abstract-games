import * as THREE from 'three';
import { BOARD } from '../constants';
import type { PieceGeometrySet } from '../types';
import { anchorGeometryBaseToY0 } from './anchor';

/** Tak silhouettes from IMPLEMENTED.md (Alex sketch override): boxes + truncated pyramid capstone. */
function createTruncatedPyramid(base: number, top: number, height: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const halfBase = base / 2;
  const halfTop = top / 2;
  const vertices = new Float32Array([
    -halfBase, 0, -halfBase, halfBase, 0, -halfBase, halfBase, 0, halfBase, -halfBase, 0, halfBase,
    -halfTop, height, -halfTop, halfTop, height, -halfTop, halfTop, height, halfTop, -halfTop, height, halfTop,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
  ];
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function createTakPieceGeometries(): {
  flat: THREE.BufferGeometry;
  standing: THREE.BufferGeometry;
  capstone: THREE.BufferGeometry;
} {
  const flat = anchorGeometryBaseToY0(new THREE.BoxGeometry(0.68, 0.18, 0.68));
  const standing = anchorGeometryBaseToY0(new THREE.BoxGeometry(0.68, 0.68, 0.18));
  const capstone = anchorGeometryBaseToY0(createTruncatedPyramid(0.56, 0.28, 0.78));
  return { flat, standing, capstone };
}

/** Stack step from an axis-aligned bounding box (geometry or scaled model). */
export function heightFromBoundingBox(box: THREE.Box3): number {
  return box.max.y - box.min.y;
}

export function geometryBoundingBoxHeight(geo: THREE.BufferGeometry): number {
  if (!geo.boundingBox) geo.computeBoundingBox();
  return heightFromBoundingBox(geo.boundingBox!);
}

export function takPieceGeometrySet(geos: ReturnType<typeof createTakPieceGeometries>): PieceGeometrySet {
  const map: Record<string, THREE.BufferGeometry> = {
    flat: geos.flat,
    standing: geos.standing,
    capstone: geos.capstone,
  };
  return {
    geometry(piece) {
      return map[piece.shape] ?? geos.flat;
    },
    height(piece) {
      const geo = map[piece.shape] ?? geos.flat;
      return geometryBoundingBoxHeight(geo);
    },
    edgeThreshold: BOARD.EDGE_THRESHOLD_TAK,
    yaw(id: string) {
      let hash = 2166136261;
      for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
      hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
      hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
      hash ^= hash >>> 16;
      return ((hash >>> 0) / 4294967295) * (Math.PI / 6);
    },
  };
}
