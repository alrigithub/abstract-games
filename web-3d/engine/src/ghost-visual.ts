import * as THREE from 'three';

/** Same mesh/material as the live piece, drawn translucent for move previews. */
export function applyGhostOpacity(root: THREE.Object3D, opacity = 0.5): void {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = false;
    node.receiveShadow = false;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    node.material = materials.map(mat => {
      const clone = mat.clone();
      clone.transparent = true;
      clone.opacity = opacity;
      clone.depthWrite = false;
      return clone;
    });
    if (node.material.length === 1) node.material = node.material[0]!;
  });
}
