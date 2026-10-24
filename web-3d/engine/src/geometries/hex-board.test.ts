import { describe, expect, it } from 'vitest';
import {
  TZAAR_CENTER,
  TZAAR_GRID,
  createTzaarBoardLineGeometry,
  tzaarCornerCoords,
  tzaarFixedStart,
  tzaarGridLineSegments,
  tzaarIsPlayable,
  tzaarPlayableCells,
  tzaarWorldPosition,
} from './hex-board';

const SQRT3_2 = Math.sqrt(3) / 2;

describe('tzaar hex board', () => {
  it('has 60 playable intersections and an empty centre', () => {
    const cells = tzaarPlayableCells();
    expect(cells).toHaveLength(60);
    expect(tzaarIsPlayable(TZAAR_CENTER.x, TZAAR_CENTER.y)).toBe(false);
    expect(cells.some(c => c.x === TZAAR_CENTER.x && c.y === TZAAR_CENTER.y)).toBe(false);
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

  it('places neighbors of the two short axes one pitch apart', () => {
    const a = tzaarWorldPosition(4, 3);
    const east = tzaarWorldPosition(5, 3);
    const se = tzaarWorldPosition(4, 4); // centre is empty; use (5,3)-(5,4)
    expect(a.distanceTo(east)).toBeCloseTo(1, 5);
    expect(tzaarWorldPosition(5, 3).distanceTo(tzaarWorldPosition(5, 4))).toBeCloseTo(1, 5);
    expect(se.x).toBeCloseTo(0, 5);
    expect(se.z).toBeCloseTo(0, 5);
  });

  it('draws three line families and never crosses the empty centre', () => {
    const segs = tzaarGridLineSegments();
    expect(segs.length).toBeGreaterThan(40);
    const dirs = new Set(segs.map(s => s.dir));
    expect(dirs).toEqual(new Set(['e', 'se', 'sw']));

    for (const seg of segs) {
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

    const undirected = (seg: (typeof segs)[number]) => {
      const a = Math.atan2(seg.to.z - seg.from.z, seg.to.x - seg.from.x);
      const t = ((a % Math.PI) + Math.PI) % Math.PI;
      return t > Math.PI / 2 ? t - Math.PI : t;
    };
    const angles = ['e', 'se', 'sw'].map(dir => undirected(segs.find(s => s.dir === dir)!));
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

  it('merges the line grid into one geometry', () => {
    const geo = createTzaarBoardLineGeometry();
    expect(geo.getAttribute('position').count).toBeGreaterThan(8);
    geo.dispose();
  });
});

describe('tzaar world basis', () => {
  it('centers the empty hole on the origin', () => {
    const c = tzaarWorldPosition(4, 4);
    expect(c.x).toBeCloseTo(0, 8);
    expect(c.z).toBeCloseTo(0, 8);
    expect(SQRT3_2).toBeCloseTo(0.866025, 5);
  });
});
