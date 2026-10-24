import { describe, expect, it } from 'vitest';
import { GIPF_AXIAL_STEPS } from '../geometries/gipf-set';
import { YINSH_COORDS, isYinshCoordInside, yinshCoordKey } from './yinsh-hex-grid';

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
});
