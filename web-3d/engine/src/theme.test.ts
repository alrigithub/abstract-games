import { describe, expect, it } from 'vitest';
import { LIGHT_ARENA_SURFACE, LIGHT_THEME_TOKENS, themeTokens, uiThemeTokens } from './theme';

function parseHex(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

describe('light theme tokens', () => {
  it('uses a neutral light-grey arena surface', () => {
    expect(LIGHT_ARENA_SURFACE).toBe('#f0f0f0');
    const { r, g, b } = parseHex(LIGHT_ARENA_SURFACE);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it('exposes the pale avocado light palette only', () => {
    expect(themeTokens()).toBe(LIGHT_THEME_TOKENS);
    expect(themeTokens().arenaSurface).toBe(LIGHT_ARENA_SURFACE);
    expect(themeTokens().piece.A!.fill).toBe('#ffffff');
    expect(themeTokens().piece.B!.fill).toBe('#000000');
  });

  it('uses light UI chrome', () => {
    const ui = uiThemeTokens();
    expect(ui.pageText).toBe('#1a1a1a');
    expect(ui.pageBg).toBe(LIGHT_THEME_TOKENS.table);
  });
});
