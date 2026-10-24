import { describe, expect, it } from 'vitest';
import {
  DARK_ARENA_SURFACE,
  LIGHT_ARENA_SURFACE,
  LIGHT_THEME_TOKENS,
  invertHex,
  invertThemeTokens,
  pieceGlbSideForPlayer,
  themeTokens,
  uiThemeTokens,
} from './theme';

function parseHex(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

describe('theme inversion', () => {
  it('inverts hex colours', () => {
    expect(invertHex('#ffffff')).toBe('#000000');
    expect(invertHex('#000000')).toBe('#ffffff');
    expect(invertHex('#ffffff')).toBe('#000000');
  });

  it('uses neutral light-grey arena surface in light mode', () => {
    expect(LIGHT_ARENA_SURFACE).toBe('#f0f0f0');
    const { r, g, b } = parseHex(LIGHT_ARENA_SURFACE);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it('derives dark scene tokens from light', () => {
    const dark = themeTokens('dark');
    expect(dark.table).toBe(invertHex(LIGHT_THEME_TOKENS.table));
    expect(dark.arenaSurface).toBe(DARK_ARENA_SURFACE);
    expect(themeTokens('light').arenaSurface).toBe(LIGHT_ARENA_SURFACE);
    expect(dark.piece.A!.fill).toBe('#000000');
    expect(dark.piece.B!.fill).toBe('#ffffff');
    expect(dark.ghostOpacity).toBeCloseTo(1 - LIGHT_THEME_TOKENS.ghostOpacity);
    expect(invertThemeTokens(dark)).toEqual(LIGHT_THEME_TOKENS);
  });

  it('swaps GLB sides in dark mode', () => {
    expect(pieceGlbSideForPlayer('light', 'A')).toBe('A');
    expect(pieceGlbSideForPlayer('light', 'B')).toBe('B');
    expect(pieceGlbSideForPlayer('dark', 'A')).toBe('B');
    expect(pieceGlbSideForPlayer('dark', 'B')).toBe('A');
  });

  it('inverts UI tokens', () => {
    const dark = uiThemeTokens('dark');
    expect(dark.pageText).toBe(invertHex('#1a1a1a'));
    expect(dark.pageBg).toBe(themeTokens('dark').table);
  });
});
