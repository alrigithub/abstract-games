import { describe, expect, it } from 'vitest';
import { GIPF_AXIAL_STEPS, gipfWorldPoint, yinshLayout, yinshLayoutEdgePoints } from '../geometries/gipf-set';
import type { BoardSnapshot } from '../types';
import {
  YINSH_COORDS,
  createYinshTopology,
  isYinshCoordInside,
  yinshCoordKey,
  yinshWorldPoint,
} from './yinsh-hex-grid';

describe('yinsh hex grid', () => {
  it('has 85 playable intersections', () => {
    expect(YINSH_COORDS.length).toBe(85);
  });

  it('draws segments along all three line families', () => {
    const inside = new Set(YINSH_COORDS.map(yinshCoordKey));
    let segments = 0;
    const families = new Set<string>();
    for (const coord of YINSH_COORDS) {
      for (const [dq, dr] of GIPF_AXIAL_STEPS) {
        const neighbor = { x: coord.x + dq, y: coord.y + dr };
        if (!inside.has(yinshCoordKey(neighbor))) continue;
        segments++;
        families.add(`${dq},${dr}`);
      }
    }
    expect(segments).toBeGreaterThan(200);
    expect(families.size).toBe(3);
  });

  it('includes demo placement coords', () => {
    for (const c of [
      { x: -2, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 0 },
    ]) {
      expect(isYinshCoordInside(c)).toBe(true);
    }
  });

  it('maps every cell index to the same world point as the printed layout', () => {
    const layout = yinshLayout();
    const topology = createYinshTopology();
    const snapshot: BoardSnapshot = {
      playableCells: 85,
      cellCount: 85,
      cells: Array.from({ length: 85 }, () => []),
    };
    for (let i = 0; i < YINSH_COORDS.length; i++) {
      const coord = YINSH_COORDS[i]!;
      const fromLayout = layout.points[i]!.world;
      const fromTopology = topology.cellPosition(i, snapshot);
      const fromHelper = yinshWorldPoint(coord);
      const fromGipf = gipfWorldPoint(coord.x, coord.y);
      expect(fromTopology.x).toBeCloseTo(fromLayout.x, 8);
      expect(fromTopology.z).toBeCloseTo(fromLayout.z, 8);
      expect(fromHelper.x).toBeCloseTo(fromGipf.x, 8);
      expect(fromHelper.z).toBeCloseTo(fromGipf.z, 8);
    }
  });

  it('has rim points where grid lines meet the board edge', () => {
    const layout = yinshLayout();
    const edge = yinshLayoutEdgePoints(layout);
    expect(edge.length).toBe(30);
    const edgeKeys = new Set(edge.map(p => `${p.q},${p.r}`));
    for (const p of edge) {
      let open = 0;
      for (const [dq, dr] of [
        [1, 0],
        [0, 1],
        [1, 1],
        [-1, 0],
        [0, -1],
        [-1, -1],
      ] as const) {
        if (!layout.points.some(q => q.q === p.q + dq && q.r === p.r + dr)) open++;
      }
      expect(open).toBeGreaterThan(0);
      expect(edgeKeys.has(`${p.q},${p.r}`)).toBe(true);
    }
  });
});
