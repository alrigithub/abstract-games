import { describe, expect, it } from 'vitest';
import { YINSH_GLB_WORLD_SCALE, YINSH_RING_OUTER_DIAMETER_M, YINSH_RING_TARGET_RADIUS } from './yinsh-piece-models';

describe('yinsh GLB scale', () => {
  it('matches procedural ring outer radius', () => {
    const outerRadius = (YINSH_RING_OUTER_DIAMETER_M / 2) * YINSH_GLB_WORLD_SCALE;
    expect(outerRadius).toBeCloseTo(YINSH_RING_TARGET_RADIUS, 6);
    expect(YINSH_GLB_WORLD_SCALE).toBeCloseTo(31.4375, 4);
  });
});
