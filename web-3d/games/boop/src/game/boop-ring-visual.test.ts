import { describe, expect, it } from 'vitest';
import { boopMarkerHaloExtraRadiusPx, boopMarkerStrokePx } from './boop-ring-visual';

describe('boop ring marker sizing', () => {
  it('matches design reference stroke at 96px and 156px diameters', () => {
    expect(boopMarkerStrokePx(96, false)).toBeCloseTo(9, 1);
    expect(boopMarkerStrokePx(156, true)).toBeCloseTo(13, 1);
  });

  it('adds 20px halo radius at reference diameters', () => {
    expect(boopMarkerHaloExtraRadiusPx(96, false)).toBeCloseTo(20, 1);
    expect(boopMarkerHaloExtraRadiusPx(156, true)).toBeCloseTo(20, 1);
  });
});
