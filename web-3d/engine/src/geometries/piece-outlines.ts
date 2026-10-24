import * as THREE from 'three';
import { BOARD } from '../constants';

export function decoratePieceMesh(
  mesh: THREE.Mesh,
  edgeMaterial: THREE.LineBasicMaterial,
  outlineMaterial: THREE.MeshBasicMaterial,
  edgeCache: Map<THREE.BufferGeometry, THREE.EdgesGeometry>,
  threshold: number = BOARD.EDGE_THRESHOLD_TAK,
  options?: { hullOutline?: boolean; edgeLines?: boolean },
): THREE.Mesh {
  mesh.clear();
  if (options?.hullOutline !== false) {
    const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
    outlineMaterial.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed += normal * ${BOARD.OUTLINE_EXPAND};`,
      );
    };
    mesh.add(outline);
  }
  if (options?.edgeLines !== false) {
    let edges = edgeCache.get(mesh.geometry);
    if (!edges) {
      edges = new THREE.EdgesGeometry(mesh.geometry, threshold);
      edgeCache.set(mesh.geometry, edges);
    }
    mesh.add(new THREE.LineSegments(edges, edgeMaterial));
  }
  return mesh;
}
