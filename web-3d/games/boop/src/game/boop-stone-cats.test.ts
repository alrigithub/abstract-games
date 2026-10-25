import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  attachContactShadow,
  attachShadowStandIn,
  baseFootprintRadiusLocal,
  BOOP_STONE_CAT_YAW,
} from './boop-stone-cats';

describe('boop stone cats', () => {
  it('uses a stable camera-facing yaw', () => {
    expect(Number.isFinite(BOOP_STONE_CAT_YAW)).toBe(true);
  });

  it('keeps contact shadow near the vase base in world space when the visual is scaled', () => {
    const visual = new THREE.Group();
    visual.scale.setScalar(42);
    visual.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.5, 16)));
    attachContactShadow(visual, baseFootprintRadiusLocal(visual), 'light');
    visual.updateMatrixWorld(true);
    const disk = visual.getObjectByName('__boopContactShadow')!;
    const vaseBox = new THREE.Box3().setFromObject(visual);
    const vaseSize = new THREE.Vector3();
    vaseBox.getSize(vaseSize);
    const diskBox = new THREE.Box3().setFromObject(disk);
    const diskSize = new THREE.Vector3();
    diskBox.getSize(diskSize);
    const vaseFootprint = Math.max(vaseSize.x, vaseSize.z);
    const diskDiameter = Math.max(diskSize.x, diskSize.z);
    expect(diskDiameter).toBeLessThan(vaseFootprint * 0.85);
    expect(diskDiameter).toBeGreaterThan(vaseFootprint * 0.35);
  });

  it('sizes contact shadow after the shadow stand-in is attached', () => {
    const vase = new THREE.Group();
    vase.scale.setScalar(30);
    vase.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.5, 16)));
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.2);
    geometry.translate(0, 0.6, 0);
    attachShadowStandIn(vase, geometry);
    attachContactShadow(vase, baseFootprintRadiusLocal(vase), 'light');
    vase.updateMatrixWorld(true);
    const disk = vase.getObjectByName('__boopContactShadow')!;
    const vaseBox = new THREE.Box3().setFromObject(vase);
    const vaseSize = new THREE.Vector3();
    vaseBox.getSize(vaseSize);
    const diskBox = new THREE.Box3().setFromObject(disk);
    const diskSize = new THREE.Vector3();
    diskBox.getSize(diskSize);
    const vaseFootprint = Math.max(vaseSize.x, vaseSize.z);
    const diskDiameter = Math.max(diskSize.x, diskSize.z);
    expect(diskDiameter).toBeLessThan(vaseFootprint * 0.85);
  });
});
