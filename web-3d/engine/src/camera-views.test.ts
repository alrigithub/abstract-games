import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  cameraPoseForPreset,
  fitOrthographicToWorldPoints,
  INITIAL_CAMERA_PRESET,
  nextCameraPresetAfter,
} from './camera-views';

describe('camera-views', () => {
  it('cycles axo → top → axo on each toggle target', () => {
    expect(INITIAL_CAMERA_PRESET).toBe('axo');
    expect(nextCameraPresetAfter('axo')).toBe('top');
    expect(nextCameraPresetAfter('top')).toBe('axo');
    expect(nextCameraPresetAfter(nextCameraPresetAfter('axo'))).toBe('axo');
  });

  it('fits orthographic frustum to world bounds for the current pose', () => {
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    const target = new THREE.Vector3(0, 0, 0);
    const top = cameraPoseForPreset(target, 'top');
    camera.position.copy(top.position);
    camera.up.copy(top.up);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);

    const half = 3;
    const points = [
      new THREE.Vector3(-half, 0, -half),
      new THREE.Vector3(half, 0, half),
      new THREE.Vector3(-half, 1.2, half),
      new THREE.Vector3(half, 0, -half),
    ];
    fitOrthographicToWorldPoints(camera, points, 16 / 9, 1.1);

    const probe = new THREE.Vector3();
    const corners = [
      new THREE.Vector3(-half, 0, -half),
      new THREE.Vector3(half, 1.2, half),
    ];
    for (const corner of corners) {
      probe.copy(corner).applyMatrix4(camera.matrixWorldInverse);
      expect(probe.x).toBeGreaterThanOrEqual(camera.left - 0.05);
      expect(probe.x).toBeLessThanOrEqual(camera.right + 0.05);
      expect(probe.y).toBeGreaterThanOrEqual(camera.bottom - 0.05);
      expect(probe.y).toBeLessThanOrEqual(camera.top + 0.05);
    }
  });

  it('axo pose matches ~35° elevation and 45° azimuth', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const { position } = cameraPoseForPreset(target, 'axo', 15);
    const dx = position.x - target.x;
    const dy = position.y - target.y;
    const dz = position.z - target.z;
    const horiz = Math.hypot(dx, dz);
    const elevation = Math.atan2(dy, horiz);
    const azimuth = Math.atan2(dx, dz);
    expect(elevation).toBeCloseTo((35 * Math.PI) / 180, 2);
    expect(azimuth).toBeCloseTo(Math.PI / 4, 2);
  });
});
