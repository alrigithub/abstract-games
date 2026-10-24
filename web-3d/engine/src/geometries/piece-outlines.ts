import * as THREE from 'three';
import { BOARD } from '../constants';

export function decoratePieceMesh(
  mesh: THREE.Mesh,
  edgeMaterial: THREE.LineBasicMaterial,
  outlineMaterial: THREE.MeshBasicMaterial,
  edgeCache: Map<THREE.BufferGeometry, THREE.EdgesGeometry>,
  threshold: number = BOARD.EDGE_THRESHOLD_TAK,
): THREE.Mesh {
  mesh.clear();
  const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
  outlineMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\ntransformed += normal * ${BOARD.OUTLINE_EXPAND};`,
    );
  };
  mesh.add(outline);
  let edges = edgeCache.get(mesh.geometry);
  if (!edges) {
    edges = new THREE.EdgesGeometry(mesh.geometry, threshold);
    edgeCache.set(mesh.geometry, edges);
  }
  mesh.add(new THREE.LineSegments(edges, edgeMaterial));
  return mesh;
}

export function makePieceShadow(
  geo: THREE.BufferGeometry,
  material: THREE.MeshBasicMaterial,
  group: THREE.Group,
): THREE.Mesh {
  const shadow = new THREE.Mesh(geo, material);
  shadow.scale.set(BOARD.SHADOW_SCALE, 0.001, BOARD.SHADOW_SCALE);
  shadow.position.y = 0;
  shadow.renderOrder = 1;
  group.add(shadow);
  return shadow;
}
