import type { BoardBuildContext, ThemeTokens } from './types';
import { CLAY } from './constants';

export type { ThemeTokens };

/** Win / highlight accent. */
export const WIN_ACCENT = '#3b82f6';

const PIECE_LIGHT = {
  A: { fill: '#ffffff', rim: '#000000', edge: '#000000' },
  B: { fill: '#000000', rim: '#ffffff', edge: '#ffffff' },
} as const;

/** Neutral light-grey token for clay-tinted arenas (Yinsh). Boop and Gomoku arenas use the shared white playfield material. */
export const LIGHT_ARENA_SURFACE = '#f0f0f0';

export const LIGHT_THEME_TOKENS: ThemeTokens = {
  table: CLAY.ENV,
  board: CLAY.ENV,
  lines: '#5c564c',
  arenaSurface: LIGHT_ARENA_SURFACE,
  win: WIN_ACCENT,
  runCelebration: '#ffb347',
  ghostOpacity: 0.24,
  shadow: '#19232e',
  piece: {
    A: { ...PIECE_LIGHT.A },
    B: { ...PIECE_LIGHT.B },
  },
};

/** GIPF-style printed boards built from live board materials (Tzaar topology, Yinsh hex grid). */
export function themeTokensFromBoardContext(ctx: BoardBuildContext): ThemeTokens {
  void ctx;
  const board = CLAY.ENV;
  const lines = `#${ctx.gridMaterial.color.getHexString()}`;
  return {
    table: board,
    board,
    lines,
    arenaSurface: board,
    win: LIGHT_THEME_TOKENS.win,
    runCelebration: LIGHT_THEME_TOKENS.runCelebration,
    ghostOpacity: LIGHT_THEME_TOKENS.ghostOpacity,
    shadow: lines,
    piece: {},
  };
}

/** Shared UI chrome colours (page shell + game menu). */
export const LIGHT_UI_TOKENS = {
  pageText: '#1a1a1a',
  pageBg: LIGHT_THEME_TOKENS.table,
  gameBtnBorder: '#d4d4d8',
  gameBtnBg: '#ffffff',
  gameBtnActive: '#f4f4f5',
  gameBtnMuted: '#71717a',
  gameMenuBorder: '#e4e4e7',
  gameMenuBg: '#ffffff',
  gameMenuSeparator: '#ececec',
  gameMenuHover: '#f4f4f5',
  gameMenuFocus: '#2563eb',
  actionButtonShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
} as const;

export type UiThemeTokens = {
  [K in keyof typeof LIGHT_UI_TOKENS]: string;
};

export function uiThemeTokens(): UiThemeTokens {
  return { ...LIGHT_UI_TOKENS };
}

export function themeTokens(): ThemeTokens {
  return LIGHT_THEME_TOKENS;
}

export const DEFAULT_PLAYERS: readonly string[] = ['A', 'B'];

function applyUiCssVars(): void {
  const ui = uiThemeTokens();
  const root = document.documentElement;
  root.style.setProperty('--ui-page-text', ui.pageText);
  root.style.setProperty('--ui-page-bg', ui.pageBg);
  root.style.setProperty('--game-btn-border', ui.gameBtnBorder);
  root.style.setProperty('--game-btn-bg', ui.gameBtnBg);
  root.style.setProperty('--game-btn-active', ui.gameBtnActive);
  root.style.setProperty('--game-btn-muted', ui.gameBtnMuted);
  root.style.setProperty('--game-menu-border', ui.gameMenuBorder);
  root.style.setProperty('--game-menu-bg', ui.gameMenuBg);
  root.style.setProperty('--game-menu-separator', ui.gameMenuSeparator);
  root.style.setProperty('--game-menu-hover', ui.gameMenuHover);
  root.style.setProperty('--game-menu-focus', ui.gameMenuFocus);
  root.style.setProperty('--ui-action-button-shadow', ui.actionButtonShadow);
  const scene = themeTokens();
  root.style.setProperty('--theme-win', scene.win);
  root.style.setProperty('--theme-win-rgb', hexToRgbCsv(scene.win));
}

function expandHex(hex: string): string {
  const h = hex.replace('#', '').toLowerCase();
  if (h.length === 3) return h.split('').map(c => c + c).join('');
  return h;
}

function hexToRgbCsv(hex: string): string {
  const raw = expandHex(hex);
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/** Applies the light UI CSS variables on the document root. */
export function applyDocumentTheme(): void {
  if (typeof document === 'undefined') return;
  delete document.documentElement.dataset.theme;
  applyUiCssVars();
}
