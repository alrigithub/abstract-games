import { describe, expect, it } from 'vitest';
import { createTakPieceGeometries, takPieceGeometrySet } from './tak-pieces';

describe('tak piece geometries', () => {
  it('anchors every silhouette so the base rests on y=0', () => {
    const geos = createTakPieceGeometries();
    for (const geo of [geos.flat, geos.standing, geos.capstone]) {
      geo.computeBoundingBox();
      const box = geo.boundingBox!;
      expect(box.min.y).toBeCloseTo(0, 5);
      expect(box.max.y - box.min.y).toBeGreaterThan(0.1);
    }
  });

  it('reports stack heights from bounding boxes', () => {
    const set = takPieceGeometrySet(createTakPieceGeometries());
    expect(set.height({ id: 'a', player: 'A', shape: 'flat' })).toBeCloseTo(0.18, 4);
    expect(set.height({ id: 'b', player: 'A', shape: 'standing' })).toBeCloseTo(0.68, 4);
    expect(set.height({ id: 'c', player: 'A', shape: 'capstone' })).toBeCloseTo(0.78, 4);
  });
});
