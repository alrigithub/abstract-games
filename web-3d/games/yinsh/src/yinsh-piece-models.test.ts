import { describe, expect, it } from 'vitest';
import {
  YINSH_GLB_WORLD_SCALE,
  YINSH_RING_OUTER_DIAMETER_M,
  YINSH_RING_TARGET_OUTER_DIAMETER,
  YINSH_RING_TARGET_RADIUS,
} from './yinsh-piece-models';

describe('yinsh GLB scale', () => {
  it('maps 32 mm ring outer diameter to board spacing footprint', () => {
    const outerDiameter = YINSH_RING_OUTER_DIAMETER_M * YINSH_GLB_WORLD_SCALE;
    expect(outerDiameter).toBeCloseTo(YINSH_RING_TARGET_OUTER_DIAMETER, 6);
    expect(YINSH_RING_TARGET_RADIUS).toBeCloseTo(YINSH_RING_TARGET_OUTER_DIAMETER / 2, 6);
    expect(YINSH_GLB_WORLD_SCALE).toBeCloseTo(30, 4);
  });
});
