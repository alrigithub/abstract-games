import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CLAY } from './constants';
import {
  applyClayEnvMaterials,
  applyClayMaterials,
  applyClayPieceMaterials,
  clayMaterialBankSnapshot,
  clayMaterialRoleForName,
  getClayMaterial,
  syncClayMaterialTheme,
} from './clay-materials';

describe('clay materials', () => {
  it('exposes shared matte PBR instances per role', () => {
    const env = getClayMaterial('env');
    const light = getClayMaterial('piece_light');
    const dark = getClayMaterial('piece_dark');
    expect(env.roughness).toBe(CLAY.ENV_MATERIAL_ROUGHNESS);
    expect(light.roughness).toBe(CLAY.MATERIAL_ROUGHNESS);
    expect(env.metalness).toBe(0);
    expect(env).toBe(getClayMaterial('env'));
    expect(light).not.toBe(dark);
  });

  it('honours Blender clay_* material names', () => {
    expect(clayMaterialRoleForName('clay_env')).toBe('env');
    expect(clayMaterialRoleForName('Clay_Light')).toBe('piece_light');
    expect(clayMaterialRoleForName('clay_dark')).toBe('piece_dark');
  });

  it('assigns shared env materials to arena GLBs', () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xff00ff }),
    );
    const root = new THREE.Group();
    root.add(mesh);
    applyClayEnvMaterials(root);
    expect(mesh.material).toBe(getClayMaterial('env'));
    expect(`#${(mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`).toBe(CLAY.ENV);
  });

  it('forces env on arena GLBs even when Blender names say piece_dark', () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ name: 'clay_dark' }),
    );
    const root = new THREE.Group();
    root.add(mesh);
    applyClayEnvMaterials(root);
    expect(mesh.material).toBe(getClayMaterial('env'));
  });

  it('assigns piece side defaults and rebinding on clone', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: 'clay_dark' }));
    const root = new THREE.Group();
    root.add(mesh);
    applyClayPieceMaterials(root, 'light');
    expect(mesh.material).toBe(getClayMaterial('piece_dark'));

    const named = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: 'clay_light' }));
    const namedRoot = new THREE.Group();
    namedRoot.add(named);
    applyClayMaterials(namedRoot, { pieceSide: 'dark' });
    expect(named.material).toBe(getClayMaterial('piece_light'));
  });

  it('syncs env albedo for dark theme', () => {
    syncClayMaterialTheme('light');
    expect(clayMaterialBankSnapshot().env).toBe(CLAY.ENV);
    syncClayMaterialTheme('dark');
    expect(clayMaterialBankSnapshot().env).toBe(CLAY.ENV_DARK);
    syncClayMaterialTheme('light');
  });
});
