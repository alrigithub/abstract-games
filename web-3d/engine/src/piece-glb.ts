import * as THREE from 'three';
import type { ThemeId } from './theme';
import { setMeshShadowFlags } from './board-lighting';
import { cloneMeshMaterials } from './ghost-visual';

export interface ApplyPieceGlbThemeMaterialsOptions {
  /** When true, keep authored GLB materials (textures, PBR) instead of clay overrides. */
  keepGlbMaterials?: boolean;
}

/** Piece GLBs: optional no-op when keeping authored materials (theme must not repaint stones). */
export function applyPieceGlbThemeMaterials(
  root: THREE.Object3D,
  _themeId: ThemeId,
  options: ApplyPieceGlbThemeMaterialsOptions = { keepGlbMaterials: true },
): void {
  void _themeId;
  void options;
}

/** Every mesh in an authored piece GLB casts and receives directional shadows. */
export function tagPieceGlbMeshesForShadows(root: THREE.Object3D): void {
  setMeshShadowFlags(root, { cast: true, receive: true });
  root.traverse(node => {
    if (node instanceof THREE.LineSegments) {
      node.castShadow = false;
      node.receiveShadow = false;
    }
  });
}

/** After load: isolate materials and configure shadows before templating. */
export function prepareAuthoredPieceGlb(root: THREE.Object3D, themeId: ThemeId = 'light'): void {
  applyPieceGlbThemeMaterials(root, themeId, { keepGlbMaterials: true });
  cloneMeshMaterials(root);
  tagPieceGlbMeshesForShadows(root);
}
