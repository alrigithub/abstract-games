import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BoardAssistLayer } from './board-assist';
import { BOARD } from './constants';
import { themeTokens } from './theme';

describe('BoardAssistLayer', () => {
  const cellPosition = (index: number) => new THREE.Vector3(index * 0.5, 0, 0);

  it('never draws path ribbon segments (paths removed)', () => {
    const layer = new BoardAssistLayer();
    layer.update(
      {
        pathCells: [0, 1, 2],
        pathFromWorld: { x: 0, z: 0 },
        pathToWorld: { x: 1, z: 0 },
        lastMove: { fromCell: 0, toCell: 2, pathCells: [0, 1, 2] },
      },
      cellPosition,
    );
    expect(layer.getStats().pathSegmentCount).toBe(0);
  });

  it('clears assist when state is null', () => {
    const layer = new BoardAssistLayer();
    layer.update({ destinationCells: [0], destinationDotRadius: 0.05 }, cellPosition);
    expect(layer.getStats().visibleMeshCount).toBeGreaterThan(0);

    layer.update(null, cellPosition);
    expect(layer.getStats().pathSegmentCount).toBe(0);
    expect(layer.getStats().visibleMeshCount).toBe(0);
  });

  it('omits stale meshes after hover shadow is cleared', () => {
    const layer = new BoardAssistLayer();
    layer.update(
      {
        shadows: [{ cell: 1, footprint: { shape: 'ring', outerRadius: 0.4, innerRadius: 0.2 }, strength: 'hover' }],
      },
      cellPosition,
    );
    const withHover = layer.getStats().visibleMeshCount;
    expect(withHover).toBeGreaterThan(0);

    layer.update({ destinationCells: [0, 1] }, cellPosition);
    expect(layer.getStats().pathSegmentCount).toBe(0);
    expect(layer.getStats().visibleMeshCount).toBe(2);
    layer.update(null, cellPosition);
    expect(layer.getStats().visibleMeshCount).toBe(0);
  });

  it('draws run celebration halos without path segments', () => {
    const layer = new BoardAssistLayer();
    layer.applyTheme(themeTokens());
    layer.update(
      {
        runGlows: [{ markerCells: [0, 1, 2, 3, 4], strength: 'announce' }],
        runGlowStyle: { markerRadius: 0.31, haloScale: 2.2 },
      },
      cellPosition,
    );
    expect(layer.getStats().pathSegmentCount).toBe(0);
    expect(layer.getStats().runGlowCellCount).toBe(5);
    expect(layer.getStats().visibleMeshCount).toBeGreaterThanOrEqual(5);
  });

  it('draws assist below piece render order', () => {
    const layer = new BoardAssistLayer();
    layer.update({ destinationCells: [0], destinationDotRadius: 0.05 }, cellPosition);
    expect(layer.getStats().visibleMeshCount).toBe(1);
    expect(BOARD.LINE_Y).toBeLessThan(0.01);
  });
});
