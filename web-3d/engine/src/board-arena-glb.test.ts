import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  applyArenaPlayfieldMaterial,
  applyArenaGlbThemeMaterials,
  arenaPlayfieldMaterial,
  tagArenaGlbForShadows,
} from './board-arena-glb';
import { CLAY } from './constants';
import { tagPlayfieldForShadows } from './board-lighting';

describe('board arena glb helpers', () => {
  it('keeps paving as a receiver and preserves ruin shadows through board rebuilds', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1));
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 0.4));
    const root = new THREE.Group();
    root.add(mesh, column);
    tagArenaGlbForShadows(root);
    tagPlayfieldForShadows(root);
    expect(mesh.castShadow).toBe(false);
    expect(mesh.receiveShadow).toBe(true);
    expect(column.castShadow).toBe(true);
    expect(column.receiveShadow).toBe(true);
  });

  it('tints arena albedo to the light clay colour without removing its normal-map detail', () => {
    const normalMap = new THREE.Texture();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ normalMap }));
    const root = new THREE.Group();
    root.add(mesh);
    applyArenaGlbThemeMaterials(root, { tintToTheme: true });
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(CLAY.ENV.slice(1));
    expect((mesh.material as THREE.MeshStandardMaterial).normalMap).toBe(normalMap);
    normalMap.dispose();
  });

  it('preserves authored materials when keepGlbMaterials is set', () => {
    const authored = 0xff0088;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: authored }),
    );
    const root = new THREE.Group();
    root.add(mesh);
    applyArenaGlbThemeMaterials(root, { keepGlbMaterials: true });
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(authored);
  });

  it('assigns shared clay ENV material regardless of authored GLB colors', () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    const root = new THREE.Group();
    root.add(mesh);
    applyArenaGlbThemeMaterials(root);
    expect(`#${(mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`).toBe(CLAY.ENV);
  });

  it('shares one matte white playfield material and drops baked maps', () => {
    const ao = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x73806a, map: ao, aoMap: ao, lightMap: ao }),
    );
    const root = new THREE.Group();
    root.add(mesh);
    applyArenaPlayfieldMaterial(root);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat).toBe(arenaPlayfieldMaterial());
    expect(mat.color.getHexString()).toBe('ffffff');
    expect(mat.roughness).toBe(0.82);
    expect(mat.metalness).toBe(0);
    expect(mat.side).toBe(THREE.DoubleSide);
    expect(mat.map).toBeNull();
    ao.dispose();
  });
});
