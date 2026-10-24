import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BOARD } from '../constants';
import { contactShadowScaleFromGeometry } from './piece-outlines';

describe('contactShadowScaleFromGeometry', () => {
  it('keeps legacy minimum for small footprints (Tak stones)', () => {
    const geo = new THREE.BoxGeometry(0.68, 0.2, 0.68);
    geo.computeBoundingBox();
    expect(contactShadowScaleFromGeometry(geo)).toBeCloseTo(BOARD.SHADOW_SCALE * 0.95, 5);
  });

  it('expands decal for wide footprints (Boop vases)', () => {
    const geo = new THREE.BoxGeometry(0.96, 0.4, 0.96);
    geo.computeBoundingBox();
    const scale = contactShadowScaleFromGeometry(geo);
    expect(scale).toBeGreaterThan(BOARD.SHADOW_SCALE * 0.95);
    expect(scale).toBeCloseTo(0.96 * BOARD.SHADOW_SCALE * 1.06, 5);
  });
});
