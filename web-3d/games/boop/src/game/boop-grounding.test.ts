import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBoopCatGeometry, createBoopKittenGeometry } from '@abstract/three-engine';
import { createGroundedBoopPieces } from './boop-grounding';

describe('boop grounding', () => {
  it('anchors geometry bases at local y=0', () => {
    for (const geo of [createBoopCatGeometry(), createBoopKittenGeometry()]) {
      expect(geo.boundingBox!.min.y).toBeCloseTo(0, 5);
    }
  });

  it('uses base geometry origin for stack placement', () => {
    const set = createGroundedBoopPieces(createBoopCatGeometry(), createBoopKittenGeometry());
    expect(set.geometryOrigin).toBe('base');
  });

  it('simulated mesh base meets playfield with base origin', () => {
    const geo = createBoopKittenGeometry();
    const h = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
    const mesh = new THREE.Mesh(geo);
    mesh.position.y = 0;
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    expect(box.min.y).toBeCloseTo(0, 3);
    expect(h).toBeGreaterThan(0);
  });
});
