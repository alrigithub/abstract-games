import { describe, expect, it } from 'vitest';
import { BOOP_CONTACT_HALO_DIAMETER_RATIO, BOOP_STONE_CAT_YAW, contactHaloLocalRadius } from './boop-stone-cats';

describe('boop stone cats', () => {
  it('uses a stable camera-facing yaw', () => {
    expect(Number.isFinite(BOOP_STONE_CAT_YAW)).toBe(true);
  });

  it('keeps the contact disc slightly larger than the vase base', () => {
    for (const [extent, scale] of [[0.96, 30], [0.5, 30]] as const) {
      const worldDiameter = contactHaloLocalRadius(extent, scale) * scale * 2;
      const ratio = worldDiameter / extent;
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(1.3);
      expect(ratio).toBeCloseTo(BOOP_CONTACT_HALO_DIAMETER_RATIO, 5);
    }
  });
});
