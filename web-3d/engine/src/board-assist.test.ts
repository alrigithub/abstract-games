import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BoardAssistLayer } from './board-assist';
import { BOARD } from './constants';

describe('BoardAssistLayer', () => {
  const cellPosition = (index: number) => new THREE.Vector3(index * 0.5, 0, 0);

  it('clears path segments when assist state is null', () => {
    const layer = new BoardAssistLayer();
    layer.update(
      {
        pathCells: [0, 1, 2],
        pathFromWorld: { x: 0, z: 0 },
        pathToWorld: { x: 1, z: 0 },
      },
      cellPosition,
    );
    expect(layer.getStats().pathSegmentCount).toBeGreaterThan(0);

    layer.update(null, cellPosition);
    expect(layer.getStats().pathSegmentCount).toBe(0);
    expect(layer.getStats().visibleMeshCount).toBe(0);
  });

  it('anchors path polyline at pathFromWorld and pathToWorld on the grid axis', () => {
    const layer = new BoardAssistLayer();
    layer.update(
      {
        pathCells: [0, 1, 2],
        pathFromWorld: { x: 0.05, z: 0.02 },
        pathToWorld: { x: 1, z: 0 },
      },
      cellPosition,
    );
    expect(layer.getStats().pathSegmentCount).toBe(2);
  });

  it('omits stale meshes after hover path is cleared', () => {
    const layer = new BoardAssistLayer();
    layer.update(
      {
        pathCells: [0, 1],
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

  it('draws assist below piece render order', () => {
    const layer = new BoardAssistLayer();
    layer.update({ destinationCells: [0], destinationDotRadius: 0.05 }, cellPosition);
    expect(layer.getStats().visibleMeshCount).toBe(1);
    expect(BOARD.LINE_Y).toBeLessThan(0.01);
  });
});
