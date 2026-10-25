import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  attachShadowStandIn,
  BOOP_CONTACT_SHADOW_USER_DATA,
  BOOP_STONE_CAT_YAW,
  createBoopContactShadowMesh,
} from './boop-stone-cats';

describe('boop stone cats', () => {
  it('uses a stable camera-facing yaw', () => {
    expect(Number.isFinite(BOOP_STONE_CAT_YAW)).toBe(true);
  });

  it('builds a radial contact shadow decal sized for the playfield', () => {
    const disk = createBoopContactShadowMesh(0.55, 'light');
    expect(disk.userData[BOOP_CONTACT_SHADOW_USER_DATA]).toBe(true);
    expect(disk.castShadow).toBe(false);
    const mat = disk.material as THREE.MeshBasicMaterial;
    expect(mat.depthWrite).toBe(false);
    expect(mat.map).toBeTruthy();
    expect(mat.opacity).toBeGreaterThan(0.85);
    disk.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(disk);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(1);
  });

  it('keeps contact shadow world diameter stable when parent scales', () => {
    const root = new THREE.Group();
    root.scale.setScalar(42);
    root.add(createBoopContactShadowMesh(0.5, 'light'));
    root.updateMatrixWorld(true);
    const disk = root.getObjectByName('__boopContactShadow')!;
    const diskBox = new THREE.Box3().setFromObject(disk);
    const diskSize = new THREE.Vector3();
    diskBox.getSize(diskSize);
    expect(Math.max(diskSize.x, diskSize.z)).toBeCloseTo(84, 0);
  });

  it('sizes contact shadow after the shadow stand-in is attached on the visual', () => {
    const vase = new THREE.Group();
    vase.scale.setScalar(30);
    vase.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.5, 16)));
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.2);
    geometry.translate(0, 0.6, 0);
    attachShadowStandIn(vase, geometry);
    const root = new THREE.Group();
    root.add(createBoopContactShadowMesh(0.45, 'light'));
    root.add(vase);
    root.updateMatrixWorld(true);
    const disk = root.getObjectByName('__boopContactShadow')!;
    expect(disk).toBeDefined();
    const diskBox = new THREE.Box3().setFromObject(disk);
    expect(Math.max(diskBox.max.x - diskBox.min.x, diskBox.max.z - diskBox.min.z)).toBeGreaterThan(0.8);
  });
});
