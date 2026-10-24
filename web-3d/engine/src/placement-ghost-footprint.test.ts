import { describe, expect, it } from 'vitest';
import { pxPerWorldUnit } from './placement-ghost-footprint';
import type { SceneApi } from './types';

describe('placement ghost footprint', () => {
  it('derives px per world unit from adjacent cell screens', () => {
    const scene = {
      cellScreen: (index: number) => (index === 0 ? { x: 100, y: 100 } : { x: 130, y: 100 }),
    } as unknown as SceneApi;
    const px = pxPerWorldUnit(scene, (row, col) => row * 10 + col);
    expect(px).toBeCloseTo(30, 5);
  });
});
