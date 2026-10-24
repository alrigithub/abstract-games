import { describe, expect, it } from 'vitest';
import {
  BOOP_CAT_FOOTPRINT_WORLD,
  BOOP_KITTEN_FOOTPRINT_WORLD,
  boopFootprintWorldUnits,
} from './boop-placement-footprints';

describe('boop placement footprints', () => {
  it('scales kitten smaller than cat', () => {
    expect(boopFootprintWorldUnits('kitten')).toBeLessThan(boopFootprintWorldUnits('cat'));
    expect(BOOP_KITTEN_FOOTPRINT_WORLD).toBeCloseTo(BOOP_CAT_FOOTPRINT_WORLD * (22.6 / 33), 5);
  });
});
