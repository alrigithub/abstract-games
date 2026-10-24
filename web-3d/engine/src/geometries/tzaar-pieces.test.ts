import { describe, expect, it } from 'vitest';
import {
  TZAAR_DISC_HEIGHT,
  TZAAR_DISC_RADIUS,
  createTzaarDiscGeometry,
  createTzaarDotGeometry,
  createTzaarRingGeometry,
  tzaarEmblemsFor,
  tzaarPieceGeometrySet,
} from './tzaar-pieces';

describe('tzaar discs', () => {
  it('uses the shared GIPF chip for Tzaar discs', () => {
    expect(TZAAR_DISC_RADIUS).toBeCloseTo(0.375);
    expect(TZAAR_DISC_HEIGHT).toBeCloseTo(0.13);
    const disc = createTzaarDiscGeometry();
    disc.computeBoundingBox();
    const box = disc.boundingBox!;
    expect(box.max.y - box.min.y).toBeCloseTo(0.13, 4);
    expect(box.max.x).toBeCloseTo(0.375, 3);
    disc.dispose();
  });

  it('marks Tott plain, Tzarra with a ring, Tzaar with ring and centre dot', () => {
    expect(tzaarEmblemsFor('tott')).toEqual([]);
    expect(tzaarEmblemsFor('tzarra')).toEqual(['ring']);
    expect(tzaarEmblemsFor('tzaar')).toEqual(['ring', 'dot']);
  });

  it('builds flat emblem geometry slightly above the disc top', () => {
    const ring = createTzaarRingGeometry();
    const dot = createTzaarDotGeometry();
    ring.computeBoundingBox();
    dot.computeBoundingBox();
    expect(ring.boundingBox!.min.y).toBeGreaterThan(0.06);
    expect(dot.boundingBox!.min.y).toBeGreaterThan(0.06);
    expect(ring.boundingBox!.max.x).toBeLessThan(TZAAR_DISC_RADIUS);
    expect(dot.boundingBox!.max.x).toBeLessThan(0.16);
    expect(ring.boundingBox!.max.x).toBeGreaterThan(0.16);
    ring.dispose();
    dot.dispose();
  });

  it('stacks discs by a constant height', () => {
    const set = tzaarPieceGeometrySet();
    expect(set.height({ id: 'a', player: 'A', shape: 'tott' })).toBeCloseTo(0.13);
    expect(set.height({ id: 'b', player: 'B', shape: 'tzaar' })).toBeCloseTo(0.13);
    expect(set.yaw('any')).toBe(0);
  });
});
