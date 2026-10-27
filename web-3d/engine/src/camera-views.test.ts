import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_VIEW,
  cameraPoseForPreset,
  createCameraViewController,
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

  it('restores the angled orbit exactly after top view and keeps top pivoted on the board centre', () => {
    const raf = globalThis.requestAnimationFrame;
    const cancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0)) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame;

    const element = {
      style: {},
      addEventListener() {},
      removeEventListener() {},
      getRootNode() {
        return { addEventListener() {}, removeEventListener() {} };
      },
    };
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 80);
    camera.position.set(9, 9, 9);
    camera.lookAt(0, 0, 0);
    const controls = new OrbitControls(camera, element as never);
    controls.enableDamping = false;
    controls.minPolarAngle = 0.22;
    controls.maxPolarAngle = 1.18;
    controls.target.set(0, 0, 0);
    controls.update();

    const views = createCameraViewController({
      camera,
      controls,
      getBounds: () => [new THREE.Vector3(-3, 0, -3), new THREE.Vector3(3, 0.5, 3), new THREE.Vector3(5, 0, -1)],
      getAspect: () => 4 / 3,
      transitionMs: 0,
    });

    controls.target.set(1.2, 0, -0.7);
    camera.zoom = 1.6;
    camera.updateProjectionMatrix();
    const radius = 11;
    const phi = 0.84;
    const theta = 1.25;
    const offset = new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
    camera.position.copy(controls.target).add(offset);
    camera.up.set(0, 1, 0);
    camera.lookAt(controls.target);
    controls.update();
    const angled = {
      target: controls.target.clone(),
      position: camera.position.clone(),
      zoom: camera.zoom,
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
    };

    views.setPreset('top', false);
    expect(controls.target.distanceTo(new THREE.Vector3(0, 0, 0))).toBeLessThan(1e-6);
    const topOffset = camera.position.clone().sub(controls.target);
    const topSpherical = new THREE.Spherical().setFromVector3(topOffset);
    expect(topSpherical.phi).toBeCloseTo(CAMERA_VIEW.TOP_POLAR, 2);

    views.setPreset('axo', false);
    expect(controls.target.distanceTo(angled.target)).toBeLessThan(1e-6);
    expect(camera.position.distanceTo(angled.position)).toBeLessThan(1e-4);
    expect(camera.zoom).toBeCloseTo(angled.zoom, 5);
    expect(camera.left).toBeCloseTo(angled.left, 5);
    expect(camera.right).toBeCloseTo(angled.right, 5);
    expect(camera.top).toBeCloseTo(angled.top, 5);
    expect(camera.bottom).toBeCloseTo(angled.bottom, 5);
    expect(camera.up.y).toBeCloseTo(1, 5);

    views.dispose();
    controls.dispose();
    globalThis.requestAnimationFrame = raf;
    globalThis.cancelAnimationFrame = cancel;
  });
});
