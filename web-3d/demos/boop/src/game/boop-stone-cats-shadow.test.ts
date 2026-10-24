import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BOARD, contactShadowScaleFromGeometry } from '@abstract/three-engine';

describe('boop stone vase contact shadows', () => {
  it('baked shadow geometry footprint scales contact decal past the mesh', () => {
    const footprint = 0.96;
    const geo = new THREE.BoxGeometry(footprint, 0.35, footprint);
    geo.computeBoundingBox();
    const decal = contactShadowScaleFromGeometry(geo);
    expect(decal).toBeGreaterThan(footprint);
    expect(decal).toBeCloseTo(footprint * BOARD.SHADOW_SCALE, 4);
  });
});
