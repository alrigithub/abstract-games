import { describe, expect, it } from 'vitest';
import { GIPF_CHIP } from './gipf-set';
import { YINSH, createYinshMarkerGeometry, createYinshRingGeometry } from './yinsh-pieces';

describe('yinsh pieces vs GIPF chip', () => {
  it('ring hole fits the shared chip radius', () => {
    expect(YINSH.RING_INNER).toBeGreaterThan(GIPF_CHIP.RADIUS);
  });

  it('ring is clearly taller than a marker with a thick wall', () => {
    expect(YINSH.RING_HEIGHT).toBeGreaterThan(GIPF_CHIP.HEIGHT * 1.35);
    expect(YINSH.RING_OUTER - YINSH.RING_INNER).toBeCloseTo(YINSH.RING_WALL, 5);
  });

  it('hole clearance matches chip radius plus gap', () => {
    expect(YINSH.RING_INNER - GIPF_CHIP.RADIUS).toBeCloseTo(YINSH.HOLE_CLEARANCE, 5);
  });

  it('marker uses GIPF chip height', () => {
    const geo = createYinshMarkerGeometry();
    geo.computeBoundingBox();
    const h = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
    expect(h).toBeCloseTo(GIPF_CHIP.HEIGHT, 3);
    geo.dispose();
  });

  it('ring lathe mesh is smooth and tall enough for the marker hole', () => {
    const ring = createYinshRingGeometry();
    ring.computeBoundingBox();
    const h = ring.boundingBox!.max.y - ring.boundingBox!.min.y;
    expect(h).toBeCloseTo(YINSH.RING_HEIGHT, 3);
    expect(YINSH.LATHE_SEGMENTS).toBeGreaterThanOrEqual(GIPF_CHIP.SEGMENTS);
    ring.dispose();
  });
});
