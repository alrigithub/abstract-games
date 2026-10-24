import { describe, expect, it } from 'vitest';
import { BOARD } from '../constants';
import {
  TZAAR_CENTER,
  TZAAR_GRID,
  TZAAR_LINE_W,
  TZAAR_PITCH,
  createTzaarBoardLineGeometry,
  createTzaarBoardSlabGeometry,
  createTzaarHexTopology,
  tzaarCornerCoords,
  tzaarFixedStart,
  tzaarGridLineSegments,
  tzaarIsPlayable,
  tzaarPlayableCells,
  tzaarRowCounts,
  tzaarWorldPosition,
} from './hex-board';
import { gipfRegularHexSlab, tzaarLayout } from './gipf-set';

const SQRT3_2 = Math.sqrt(3) / 2;

function snapshotFor(cells: ReturnType<typeof tzaarPlayableCells>) {
  return {
    playableCells: cells.length,
    cellCount: cells.length,
    cells: cells.map(() => []),
  };
}

describe('tzaar hex board', () => {
  it('has 60 playable intersections and an empty centre', () => {
    const cells = tzaarPlayableCells();
    expect(cells).toHaveLength(60);
    expect(tzaarIsPlayable(TZAAR_CENTER.x, TZAAR_CENTER.y)).toBe(false);
    expect(cells.some(c => c.x === TZAAR_CENTER.x && c.y === TZAAR_CENTER.y)).toBe(false);
  });

  it('counts 5,6,7,8,9,8,7,6,5 along each lattice axis including the centre hole', () => {
    expect(tzaarRowCounts('y')).toEqual([5, 6, 7, 8, 9, 8, 7, 6, 5]);
    expect(tzaarRowCounts('x')).toEqual([5, 6, 7, 8, 9, 8, 7, 6, 5]);
  });

  it('is a regular hexagon with sides of 5 points', () => {
    const corners = tzaarCornerCoords();
    expect(corners).toHaveLength(6);
    const originDists = corners.map(([x, y]) => tzaarWorldPosition(x, y).length());
    for (const d of originDists) expect(d).toBeCloseTo(4, 5);

    const sideCounts = [
      [0, 0, 1, 0],
      [4, 0, 1, 1],
      [8, 4, 0, 1],
      [8, 8, -1, 0],
      [4, 8, -1, -1],
      [0, 4, 0, -1],
    ] as const;
    for (const [sx, sy, dx, dy] of sideCounts) {
      let n = 0;
      for (let i = 0; i < TZAAR_GRID; i++) {
        const x = sx + dx * i;
        const y = sy + dy * i;
        if (tzaarIsPlayable(x, y)) n++;
      }
      expect(n).toBe(5);
    }
  });

  it('places all three hex-neighbour steps one pitch apart', () => {
    const origin = tzaarWorldPosition(4, 4);
    expect(origin.x).toBeCloseTo(0, 8);
    expect(origin.z).toBeCloseTo(0, 8);

    const east = tzaarWorldPosition(5, 4);
    const south = tzaarWorldPosition(4, 5);
    const se = tzaarWorldPosition(5, 5);
    expect(east.distanceTo(origin)).toBeCloseTo(TZAAR_PITCH, 5);
    expect(south.distanceTo(origin)).toBeCloseTo(TZAAR_PITCH, 5);
    expect(se.distanceTo(origin)).toBeCloseTo(TZAAR_PITCH, 5);
    expect(east.distanceTo(se)).toBeCloseTo(TZAAR_PITCH, 5);
    expect(south.distanceTo(se)).toBeCloseTo(TZAAR_PITCH, 5);

    const longDiagonal = tzaarWorldPosition(5, 3);
    expect(longDiagonal.distanceTo(origin)).toBeCloseTo(Math.sqrt(3), 5);
  });

  it('draws only true-neighbour segments and never crosses the empty centre', () => {
    const segs = tzaarGridLineSegments();
    expect(segs.length).toBeGreaterThan(40);
    const dirs = new Set(segs.map(s => s.dir));
    expect(dirs).toEqual(new Set(['e', 's', 'se']));

    for (const seg of segs) {
      expect(seg.from.distanceTo(seg.to)).toBeCloseTo(TZAAR_PITCH, 5);
      const ax = seg.from.x;
      const az = seg.from.z;
      const bx = seg.to.x;
      const bz = seg.to.z;
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, (-ax * dx + -az * dz) / len2));
      const nearest = Math.hypot(ax + t * dx, az + t * dz);
      expect(nearest).toBeGreaterThan(0.45);
    }

    expect(
      segs.some(seg => {
        const a = tzaarWorldPosition(5, 3);
        const b = tzaarWorldPosition(4, 4);
        return a.distanceTo(seg.from) < 1e-6 && b.distanceTo(seg.to) < 1e-6;
      }),
    ).toBe(false);

    const undirected = (seg: (typeof segs)[number]) => {
      const a = Math.atan2(seg.to.z - seg.from.z, seg.to.x - seg.from.x);
      const t = ((a % Math.PI) + Math.PI) % Math.PI;
      return t > Math.PI / 2 ? t - Math.PI : t;
    };
    const angles = ['e', 's', 'se'].map(dir => undirected(segs.find(s => s.dir === dir)!));
    expect(new Set(angles.map(a => a.toFixed(4))).size).toBe(3);
    const cornerAngles = tzaarCornerCoords()
      .map(([x, y]) => {
        const p = tzaarWorldPosition(x, y);
        return Math.atan2(p.z, p.x);
      })
      .sort((a, b) => a - b);
    for (let i = 0; i < 6; i++) {
      const next = cornerAngles[(i + 1) % 6]! + (i === 5 ? Math.PI * 2 : 0);
      expect(next - cornerAngles[i]!).toBeCloseTo(Math.PI / 3, 5);
    }
  });

  it('uses one world helper for cells, pieces, and topology', () => {
    const cells = tzaarPlayableCells();
    const topology = createTzaarHexTopology();
    const snapshot = snapshotFor(cells);
    const start = tzaarFixedStart();
    expect(start).toHaveLength(cells.length);

    for (const cell of cells) {
      const helper = tzaarWorldPosition(cell.x, cell.y);
      expect(cell.world.x).toBe(helper.x);
      expect(cell.world.z).toBe(helper.z);
      const pos = topology.cellPosition(cell.index, snapshot);
      expect(pos.x).toBe(helper.x);
      expect(pos.y).toBe(BOARD.PLAYFIELD_SURFACE_Y);
      expect(pos.z).toBe(helper.z);
    }

    for (const piece of start) {
      const helper = tzaarWorldPosition(piece.x, piece.y);
      const cell = cells[piece.index]!;
      expect(cell.x).toBe(piece.x);
      expect(cell.y).toBe(piece.y);
      expect(cell.world.x).toBe(helper.x);
      expect(cell.world.z).toBe(helper.z);
    }
  });

  it('uses the official Waltz start counts', () => {
    const start = tzaarFixedStart();
    expect(start).toHaveLength(60);
    const count = (player: 'A' | 'B', kind: 'tott' | 'tzarra' | 'tzaar') =>
      start.filter(p => p.player === player && p.kind === kind).length;
    for (const player of ['A', 'B'] as const) {
      expect(count(player, 'tzaar')).toBe(6);
      expect(count(player, 'tzarra')).toBe(9);
      expect(count(player, 'tott')).toBe(15);
    }
  });

  it('uses a regular hex slab with printed high-contrast lines', () => {
    const hex = gipfRegularHexSlab(tzaarLayout());
    const slab = createTzaarBoardSlabGeometry();
    slab.computeBoundingBox();
    const box = slab.boundingBox!;
    expect(box.max.x - box.min.x).toBeCloseTo(2 * hex.apothem, 4);
    expect(box.max.z - box.min.z).toBeCloseTo(2 * hex.circumradius, 4);
    expect((box.max.x + box.min.x) / 2).toBeCloseTo(hex.center.x, 5);
    expect((box.max.z + box.min.z) / 2).toBeCloseTo(hex.center.z, 5);
    expect(box.max.y).toBeCloseTo(BOARD.PLAYFIELD_SURFACE_Y, 5);
    expect(box.min.y).toBeCloseTo(-BOARD.SLAB, 5);
    expect(TZAAR_LINE_W).toBeGreaterThanOrEqual(0.04);
    expect(TZAAR_LINE_W).toBeLessThan(0.08);
    slab.dispose();

    const geo = createTzaarBoardLineGeometry();
    expect(geo.getAttribute('position').count).toBeGreaterThan(8);
    geo.dispose();
  });
});

describe('tzaar world basis', () => {
  it('centers the empty hole on the origin with a pointy-top lattice', () => {
    const c = tzaarWorldPosition(4, 4);
    expect(c.x).toBeCloseTo(0, 8);
    expect(c.z).toBeCloseTo(0, 8);
    expect(SQRT3_2).toBeCloseTo(0.866025, 5);
    const north = tzaarWorldPosition(4, 3);
    expect(north.x).toBeCloseTo(0, 5);
    expect(north.z).toBeCloseTo(1, 5);
  });
});
