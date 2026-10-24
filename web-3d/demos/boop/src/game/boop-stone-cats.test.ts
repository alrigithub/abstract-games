import { describe, expect, it } from 'vitest';
import { BOOP_STONE_CAT_YAW } from './boop-stone-cats';

describe('boop stone cats', () => {
  it('uses a stable camera-facing yaw', () => {
    expect(Number.isFinite(BOOP_STONE_CAT_YAW)).toBe(true);
  });
});
