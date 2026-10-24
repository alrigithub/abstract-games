import type * as THREE from 'three';

/** Shift geometry so its lowest Y sits on the board surface (y=0). */
export function anchorGeometryBaseToY0(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox!.min.y;
  if (Math.abs(minY) > 1e-6) geometry.translate(0, -minY, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
