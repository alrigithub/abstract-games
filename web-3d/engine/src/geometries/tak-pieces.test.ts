import { describe, expect, it } from 'vitest';
import { createTakPieceGeometries, geometryBoundingBoxHeight, takPieceGeometrySet } from './tak-pieces';

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
    const geos = createTakPieceGeometries();
    expect(geometryBoundingBoxHeight(geos.flat)).toBeCloseTo(0.18, 4);
    expect(geometryBoundingBoxHeight(geos.standing)).toBeCloseTo(0.68, 4);
    expect(geometryBoundingBoxHeight(geos.capstone)).toBeCloseTo(0.78, 4);
    const set = takPieceGeometrySet(geos);
    expect(set.height({ id: 'a', player: 'A', shape: 'flat' })).toBeCloseTo(geometryBoundingBoxHeight(geos.flat), 6);
    expect(set.height({ id: 'b', player: 'A', shape: 'standing' })).toBeCloseTo(geometryBoundingBoxHeight(geos.standing), 6);
    expect(set.height({ id: 'c', player: 'A', shape: 'capstone' })).toBeCloseTo(geometryBoundingBoxHeight(geos.capstone), 6);
  });
});
