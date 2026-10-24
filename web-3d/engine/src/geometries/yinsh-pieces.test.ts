import { describe, expect, it } from 'vitest';
import { GIPF_CHIP } from './gipf-set';
import { YINSH, createYinshMarkerGeometry, createYinshRingGeometry } from './yinsh-pieces';

describe('yinsh pieces vs GIPF chip', () => {
  it('ring hole fits the shared chip radius', () => {
    expect(YINSH.RING_INNER).toBeGreaterThan(GIPF_CHIP.RADIUS);
  });

  it('marker uses GIPF chip height', () => {
    const geo = createYinshMarkerGeometry();
    geo.computeBoundingBox();
    const h = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
    expect(h).toBeCloseTo(GIPF_CHIP.HEIGHT, 4);
    geo.dispose();
  });

  it('ring outer exceeds chip diameter', () => {
    expect(YINSH.RING_OUTER).toBeGreaterThan(GIPF_CHIP.RADIUS);
    const ring = createYinshRingGeometry();
    ring.dispose();
  });
});
