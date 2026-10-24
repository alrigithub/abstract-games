import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyArenaGlbThemeMaterials, tagArenaGlbForShadows } from './board-arena-glb';
import { DARK_ARENA_SURFACE, LIGHT_ARENA_SURFACE } from './theme';

describe('board arena glb helpers', () => {
  it('tags arena meshes to cast and receive shadows', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const root = new THREE.Group();
    root.add(mesh);
    tagArenaGlbForShadows(root);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });

  it('retints standard materials from theme arenaSurface tokens', () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    const root = new THREE.Group();
    root.add(mesh);
    applyArenaGlbThemeMaterials(root, 'dark');
    expect(`#${(mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`).toBe(
      DARK_ARENA_SURFACE,
    );
    applyArenaGlbThemeMaterials(root, 'light');
    expect(`#${(mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`).toBe(
      LIGHT_ARENA_SURFACE,
    );
  });
});
