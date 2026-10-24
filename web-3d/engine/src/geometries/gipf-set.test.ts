import { describe, expect, it } from 'vitest';
import {
  GIPF_CHIP,
  createGipfMarkerBodyGeometry,
  GIPF_SPACING,
  createGipfChipGeometry,
  gipfNeighborPairs,
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
});

describe('gipf chip', () => {
  it('is a single beveled disc sized from the physical GIPF set', () => {
    expect(GIPF_CHIP.RADIUS).toBeCloseTo(0.36);
    expect(GIPF_CHIP.HEIGHT).toBeCloseTo(0.13);
    const geo = createGipfChipGeometry();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    expect(box.max.y - box.min.y).toBeCloseTo(GIPF_CHIP.HEIGHT, 4);
    expect(box.max.x).toBeCloseTo(GIPF_CHIP.RADIUS, 3);
    geo.dispose();
  });

  it('marker body merges disc and rim with two material groups', () => {
    const geo = createGipfMarkerBodyGeometry();
    geo.computeBoundingBox();
    expect(geo.groups).toHaveLength(2);
    const h = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
    expect(h).toBeGreaterThan(GIPF_CHIP.HEIGHT - 0.001);
    expect(h).toBeLessThan(GIPF_CHIP.HEIGHT + 0.012);
    expect(geo.boundingBox!.min.y).toBeCloseTo(0, 3);
    geo.dispose();
  });
});
