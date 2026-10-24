import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fitPrerenderedCamera } from './prerendered-arena';

describe('registered pre-render camera', () => {
  const spec = { position: [12, 12, 12], target: [0, 0, 0], width: 18, height: 18 };
  it.each([16 / 9, 1, 9 / 16])('keeps the complete image and world geometry registered at aspect %s', aspect => {
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 80);
    camera.zoom = 4;
    fitPrerenderedCamera(camera, spec, aspect);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const corner = right.multiplyScalar(9).addScaledVector(up, 9).project(camera);
    expect(Math.abs(corner.x)).toBeLessThanOrEqual(1.000001);
    expect(Math.abs(corner.y)).toBeLessThanOrEqual(1.000001);
    expect(Math.max(Math.abs(corner.x), Math.abs(corner.y))).toBeCloseTo(1);
    expect(Math.abs(corner.x / corner.y)).toBeCloseTo(1 / aspect);
    expect(camera.position.toArray()).toEqual(spec.position);
    expect(camera.zoom).toBe(1);
    // A live object's projected point round-trips to the same world position.
    const world = new THREE.Vector3(2.5, .12, -1.5);
    expect(world.clone().project(camera).unproject(camera).distanceTo(world)).toBeLessThan(1e-10);
  });
});
