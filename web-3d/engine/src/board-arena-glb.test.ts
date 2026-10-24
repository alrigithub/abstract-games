import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyArenaGlbThemeMaterials, tagArenaGlbForShadows } from './board-arena-glb';
import { CLAY } from './constants';
import { syncClayMaterialTheme } from './clay-materials';

describe('board arena glb helpers', () => {
  it('tags arena meshes to receive (not cast) directional shadows', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const root = new THREE.Group();
    root.add(mesh);
    tagArenaGlbForShadows(root);
    expect(mesh.castShadow).toBe(false);
    expect(mesh.receiveShadow).toBe(true);
  });

  it('assigns shared clay ENV material regardless of authored GLB colors', () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    const root = new THREE.Group();
    root.add(mesh);
    syncClayMaterialTheme('light');
    applyArenaGlbThemeMaterials(root, 'light');
    expect(`#${(mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`).toBe(CLAY.ENV);
    syncClayMaterialTheme('dark');
    applyArenaGlbThemeMaterials(root, 'dark');
    expect(`#${(mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`).toBe(CLAY.ENV_DARK);
    syncClayMaterialTheme('light');
  });
});
