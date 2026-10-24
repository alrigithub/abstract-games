import { describe, expect, it } from 'vitest';
import {
  GIPF_BOARD,
  GIPF_CHIP,
  GIPF_SPACING,
  createGipfChipEdgeRingGeometry,
  createGipfChipGeometry,
  gipfHexDistanceToNearestEdge,
  gipfNeighborPairs,
  gipfPointCentroid,
  gipfRegularHexSlab,
  gipfWorldPoint,
  tzaarLayout,
  yinshLayout,
} from './gipf-set';

describe('gipf layouts', () => {
  it('gives Tzaar 60 points and Yinsh 85 points', () => {
    expect(tzaarLayout().points).toHaveLength(60);
    expect(yinshLayout().points).toHaveLength(85);
    expect(tzaarLayout().points.some(p => p.q === 0 && p.r === 0)).toBe(false);
    expect(yinshLayout().points.some(p => p.q === 0 && p.r === 0)).toBe(true);
  });

  it('places every true neighbour exactly one spacing apart', () => {
    for (const layout of [tzaarLayout(), yinshLayout()]) {
      const pairs = gipfNeighborPairs(layout);
      expect(pairs.length).toBeGreaterThan(40);
      for (const [a, b] of pairs) {
        expect(a.world.distanceTo(b.world)).toBeCloseTo(layout.spacing, 5);
      }
    }
  });

  it('uses one world helper for layout points', () => {
    for (const layout of [tzaarLayout(), yinshLayout(GIPF_SPACING)]) {
      for (const point of layout.points) {
        const helper = gipfWorldPoint(point.q, point.r, layout.spacing);
        expect(point.world.x).toBe(helper.x);
        expect(point.world.z).toBe(helper.z);
      }
    }
  });

  it('keeps the Yinsh public layout contract', () => {
    const layout = yinshLayout();
    expect(layout.id).toBe('yinsh');
    expect(layout.slab).toBe('hex');
    expect(layout.centreMotif).toBe(false);
    expect(layout.emptyCentre).toBe(false);
    expect(layout.margin).toBeCloseTo(GIPF_BOARD.MARGIN * layout.spacing, 8);
  });

  it('centres a regular hex slab on the point centroid with even outer margin', () => {
    const layout = tzaarLayout();
    expect(layout.slab).toBe('regular-hex');
    expect(layout.margin).toBeCloseTo(0.6 * layout.spacing, 8);

    const hex = gipfRegularHexSlab(layout);
    const centroid = gipfPointCentroid(layout);
    expect(hex.center.x).toBeCloseTo(centroid.x, 8);
    expect(hex.center.z).toBeCloseTo(centroid.z, 8);
    expect(hex.center.x).toBeCloseTo(0, 8);
    expect(hex.center.z).toBeCloseTo(0, 8);

    const verts = hex.vertices.map(v => Math.hypot(v.x - hex.center.x, v.z - hex.center.z));
    for (const d of verts) expect(d).toBeCloseTo(hex.circumradius, 8);
    for (let i = 0; i < 6; i++) {
      const a = hex.vertices[i]!;
      const b = hex.vertices[(i + 1) % 6]!;
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(hex.circumradius, 5);
    }

    const outer = layout.points.filter(p => Math.max(Math.abs(p.q), Math.abs(p.r), Math.abs(p.q - p.r)) === 4);
    expect(outer.length).toBe(24);
    const dists = outer.map(p => gipfHexDistanceToNearestEdge(p.world.x, p.world.z, hex.center, hex.apothem));
    const first = dists[0]!;
    for (const d of dists) expect(d).toBeCloseTo(first, 5);
    expect(first).toBeCloseTo(layout.margin, 5);
    expect(first).toBeCloseTo(hex.margin, 5);
  });
});

describe('gipf chip', () => {
  it('is a single beveled disc sized from the physical GIPF set', () => {
    expect(GIPF_CHIP.RADIUS).toBeCloseTo(0.375);
    expect(GIPF_CHIP.RADIUS * 2).toBeCloseTo(0.75 * GIPF_SPACING, 8);
    expect(GIPF_CHIP.HEIGHT).toBeCloseTo(0.13);
    const geo = createGipfChipGeometry();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    expect(box.max.y - box.min.y).toBeCloseTo(GIPF_CHIP.HEIGHT, 4);
    expect(box.max.x).toBeCloseTo(GIPF_CHIP.RADIUS, 3);
    expect(box.max.z).toBeCloseTo(GIPF_CHIP.RADIUS, 3);
    geo.dispose();

    const ring = createGipfChipEdgeRingGeometry(0);
    ring.computeBoundingBox();
    const ringBox = ring.boundingBox!;
    const ringR = Math.max(Math.abs(ringBox.max.x), Math.abs(ringBox.min.x), Math.abs(ringBox.max.z), Math.abs(ringBox.min.z));
    expect(ringR).toBeLessThanOrEqual(GIPF_CHIP.RADIUS + 1e-4);
    ring.dispose();
  });
});
