import * as THREE from 'three';
import { applyClayEnvMaterials } from './clay-materials';
import type { ThemeId } from './theme';

/** Arena GLB tiles, rubble, and columns cast and receive directional shadows. */
export function tagArenaGlbForShadows(root: THREE.Object3D): void {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

/** Shared clay ENV material for authored arena / environment GLBs. */
export function applyArenaGlbThemeMaterials(root: THREE.Object3D, _themeId: ThemeId): void {
  void _themeId;
  applyClayEnvMaterials(root);
}
