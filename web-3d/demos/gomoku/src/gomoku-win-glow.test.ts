import { describe, expect, it } from 'vitest';
import { GOMOKU_DIMS } from '@abstract/three-engine';
import { GOMOKU_WIN_GLOW_COLOR, GomokuWinGlowLayer } from './gomoku-win-glow';

describe('Gomoku win glow', () => {
  it('uses warm orange celebration colour', () => {
    expect(GOMOKU_WIN_GLOW_COLOR.toLowerCase()).toBe('#ffb347');
  });

  it('places one halo per winning cell', () => {
    const layer = new GomokuWinGlowLayer();
    layer.setWorldCells([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 },
      { x: 3, z: 0 },
      { x: 4, z: 0 },
    ]);
    expect(layer.visibleHaloCount()).toBe(5);
    expect(layer.needsContinuousRender()).toBe(true);
    layer.clear();
    expect(layer.visibleHaloCount()).toBe(0);
    layer.dispose();
    expect(GOMOKU_DIMS.STONE_R * 2.2).toBeGreaterThan(GOMOKU_DIMS.STONE_R);
  });
});
