import * as THREE from 'three';
import { rebindClayMaterialsFromUserData } from './clay-materials';

/** Deep-clone mesh materials so instances do not share GLB template materials. */
export function cloneMeshMaterials(root: THREE.Object3D): void {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const cloned = materials.map(mat => mat.clone());
    node.material = cloned.length === 1 ? cloned[0]! : cloned;
  });
}

/** Restore full opacity on live piece visuals (native GLB PBR settings). */
export function ensureOpaquePieceMaterials(root: THREE.Object3D): void {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of materials) {
      mat.transparent = false;
      mat.opacity = 1;
      mat.depthWrite = true;
      mat.needsUpdate = true;
    }
  });
}

/** Set on a piece visual template after opaque GLB materials are configured once. */
export const PIECE_OPAQUE_MATERIALS_READY_USER_DATA = 'pieceOpaqueMaterialsReady';

/** Clone template hierarchy; clay GLBs keep shared materials via userData roles. */
export function clonePieceVisualTemplate(template: THREE.Object3D): THREE.Object3D {
  const root = template.clone(true);
  rebindClayMaterialsFromUserData(root);
  if (!template.userData[PIECE_OPAQUE_MATERIALS_READY_USER_DATA]) {
    ensureOpaquePieceMaterials(root);
  }
  return root;
}

/** Same mesh/material as the live piece, drawn translucent for move previews. */
export function applyGhostOpacity(root: THREE.Object3D, opacity = 0.5): void {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = false;
    node.receiveShadow = false;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const cloned = materials.map(mat => {
      const clone = mat.clone();
      clone.transparent = true;
      clone.opacity = opacity;
      clone.depthWrite = false;
      clone.needsUpdate = true;
      return clone;
    });
    node.material = cloned.length === 1 ? cloned[0]! : cloned;
  });
}
