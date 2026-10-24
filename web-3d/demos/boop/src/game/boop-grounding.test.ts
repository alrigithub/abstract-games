import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBoopCatGeometry, createBoopKittenGeometry } from '@abstract/three-engine';
import { createGroundedBoopPieces, pieceBaseOffsetFromGeometry } from './boop-grounding';

describe('boop grounding', () => {
  it('anchors geometry bases at local y=0', () => {
    for (const geo of [createBoopCatGeometry(), createBoopKittenGeometry()]) {
      expect(geo.boundingBox!.min.y).toBeCloseTo(0, 5);
    }
  });

  it('verticalOffset lowers center-based stack layout by half height', () => {
    const cat = createBoopCatGeometry();
    const kitten = createBoopKittenGeometry();
    const set = createGroundedBoopPieces(cat, kitten);
    const catPiece = { id: 'c', player: 'A', shape: 'cat' };
    const kittenPiece = { id: 'k', player: 'A', shape: 'kitten' };
    expect(set.verticalOffset!(catPiece, 0, [catPiece])).toBeCloseTo(-set.height(catPiece) / 2, 5);
    expect(set.verticalOffset!(kittenPiece, 0, [kittenPiece])).toBeCloseTo(-set.height(kittenPiece) / 2, 5);
  });

  it('simulated mesh base meets playfield when offset is applied', () => {
    const geo = createBoopKittenGeometry();
    const h = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
    const offset = pieceBaseOffsetFromGeometry(geo);
    const mesh = new THREE.Mesh(geo);
    mesh.position.y = 0 + h / 2 + offset;
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    expect(box.min.y).toBeCloseTo(0, 3);
  });
});
