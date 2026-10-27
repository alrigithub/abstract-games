import { describe, expect, it } from 'vitest';
import { bedCellFromPlayfield, bedColumnWorldX, bedRowWorldZ, nearestEmptyBedCell } from './boop-bed-snap';
import type { SceneApi } from '@abstract/three-engine';

function mockScene(centers: Record<number, { x: number; y: number }>, pxPerCell = 80): SceneApi {
  return {
    cellScreen(index: number) {
      return centers[index] ?? { x: 0, y: 0 };
    },
  } as SceneApi;
}

describe('bedCellFromPlayfield', () => {
  it('maps a cell centre back to that cell', () => {
    expect(bedCellFromPlayfield(bedColumnWorldX(2), bedRowWorldZ(3))).toBe(3 * 6 + 2);
  });

  it('switches at the halfway boundary with no sticky band', () => {
    const edge = (bedColumnWorldX(0) + bedColumnWorldX(1)) / 2;
    expect(bedCellFromPlayfield(edge - 0.001, bedRowWorldZ(0))).toBe(0);
    expect(bedCellFromPlayfield(edge, bedRowWorldZ(0))).toBe(1);
  });

  it('returns null off the bed', () => {
    expect(bedCellFromPlayfield(bedColumnWorldX(0) - 1, bedRowWorldZ(0))).toBeNull();
  });
});

describe('nearestEmptyBedCell', () => {
  const cellAt = (row: number, col: number) => row * 6 + col;

  it('snaps to the nearest empty cell within the forgiving radius', () => {
    const centers: Record<number, { x: number; y: number }> = {
      0: { x: 100, y: 100 },
      1: { x: 180, y: 100 },
    };
    const scene = mockScene(centers);
    const hit = nearestEmptyBedCell(
      scene,
      155,
      100,
      cellAt,
      (row, col) => row === 0 && (col === 0 || col === 1),
      { maxSnapPx: 80 * 0.78 },
    );
    expect(hit).toBe(1);
  });

  it('still snaps from the gap between neighbouring cells', () => {
    const centers: Record<number, { x: number; y: number }> = {
      0: { x: 100, y: 100 },
      1: { x: 180, y: 100 },
    };
    const scene = mockScene(centers);
    const hit = nearestEmptyBedCell(scene, 140, 100, cellAt, (row, col) => row === 0 && col < 2);
    expect(hit).not.toBeNull();
  });

  it('returns null when pointer is outside snap range', () => {
    const centers = { 0: { x: 100, y: 100 } };
    const scene = mockScene(centers);
    const hit = nearestEmptyBedCell(scene, 300, 300, cellAt, () => true, { maxSnapPx: 60 });
    expect(hit).toBeNull();
  });
});
