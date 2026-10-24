import * as THREE from 'three';
import { applyClayEnvMaterials } from './clay-materials';
import type { ThemeId } from './theme';

/** Arena GLB: receive piece shadows; env geometry does not cast (avoids acne / dark bands on tiles). */
export function tagArenaGlbForShadows(root: THREE.Object3D): void {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = false;
    node.receiveShadow = true;
  });
}

export interface ApplyArenaGlbThemeMaterialsOptions {
  /** When true, keep authored GLB materials (colours, textures) instead of shared clay ENV. */
  keepGlbMaterials?: boolean;
}

/** Shared clay ENV material for authored arena / environment GLBs. */
export function applyArenaGlbThemeMaterials(
  root: THREE.Object3D,
  _themeId: ThemeId,
  options: ApplyArenaGlbThemeMaterialsOptions = {},
): void {
  void _themeId;
  if (options.keepGlbMaterials) return;
  applyClayEnvMaterials(root);
}
