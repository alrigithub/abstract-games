import { describe, expect, it } from 'vitest';
import { geometryBoundingBoxHeight, createTakPieceGeometries } from '@abstract/three-engine';
import { TAK_GLB_WORLD_SCALE, TAK_FLAT_TARGET_WIDTH, testHeightFromUnitBox } from './tak-piece-models';

describe('Tak GLB scale', () => {
  it('maps 28 mm flats to the prior ~0.68 cell fill', () => {
    expect(TAK_GLB_WORLD_SCALE * 0.028).toBeCloseTo(TAK_FLAT_TARGET_WIDTH, 5);
  });

  it('uses bounding-box height for stack steps', () => {
    expect(testHeightFromUnitBox(0.18)).toBeCloseTo(0.18, 5);
    const geos = createTakPieceGeometries();
    expect(geometryBoundingBoxHeight(geos.standing)).toBeGreaterThan(geometryBoundingBoxHeight(geos.flat));
  });
});
