import { describe, expect, it } from 'vitest';
import { discShadowAlpha, ringShadowAlpha } from './projected-shadow-texture';

describe('projected shadow alpha', () => {
  it('disc is strongest near centre and fades at edge', () => {
    expect(discShadowAlpha(0)).toBeGreaterThan(discShadowAlpha(0.5));
    expect(discShadowAlpha(0.5)).toBeGreaterThan(discShadowAlpha(1));
    expect(discShadowAlpha(1.1)).toBeLessThan(0.05);
  });

  it('ring peaks in annulus not in hole or outside', () => {
    const inner = 0.72;
    expect(ringShadowAlpha(0.3, inner)).toBeLessThan(0.05);
    const mid = (inner + 1) * 0.5;
    expect(ringShadowAlpha(mid, inner)).toBeGreaterThan(ringShadowAlpha(0.2, inner));
    expect(ringShadowAlpha(1.15, inner)).toBeLessThan(0.05);
  });
});
