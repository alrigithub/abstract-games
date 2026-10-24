import type { BoardBuildContext, ThemeId, ThemeTokens } from './types';

export type { ThemeId, ThemeTokens };

const PLAYERS = ['A', 'B'] as const;

/** Light-theme win / highlight accent (dark theme uses {@link invertHex} on this). */
export const WIN_ACCENT = '#3b82f6';

const PIECE_LIGHT = {
  A: { fill: '#ffffff', rim: '#000000', edge: '#000000' },
  B: { fill: '#000000', rim: '#ffffff', edge: '#ffffff' },
} as const;

/** Canonical light palette; dark theme is always derived via {@link invertThemeTokens}. */
/** Warm off-white arena tiles in light mode (not pure #fff). */
export const LIGHT_ARENA_SURFACE = '#e8e3da';

/** Warm mid-grey slate for dark-mode arena (not colour-inverted white). */
export const DARK_ARENA_SURFACE = '#5a5652';

export const LIGHT_THEME_TOKENS: ThemeTokens = {
  table: '#ffffff',
  board: '#ffffff',
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
  const board = `#${ctx.boardMaterial.color.getHexString()}`;
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

/** Shared UI chrome colours (page shell + game menu); dark values are inverted in {@link applyDocumentTheme}. */
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
  actionButtonShadowDark: '0 6px 20px rgba(0, 0, 0, 0.35)',
} as const;

export type UiThemeTokens = {
  [K in keyof typeof LIGHT_UI_TOKENS]: string;
};

function expandHex(hex: string): string {
  const h = hex.replace('#', '').toLowerCase();
  if (h.length === 3) return h.split('').map(c => c + c).join('');
  return h;
}

/** Inverts an `#rgb` / `#rrggbb` sRGB hex (alpha channel unchanged if ever added). */
export function invertHex(hex: string): string {
  const raw = expandHex(hex);
  const r = 255 - parseInt(raw.slice(0, 2), 16);
  const g = 255 - parseInt(raw.slice(2, 4), 16);
  const b = 255 - parseInt(raw.slice(4, 6), 16);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function invertPieceColors(piece: ThemeTokens['piece']): ThemeTokens['piece'] {
  const out: ThemeTokens['piece'] = {};
  for (const id of PLAYERS) {
    const p = piece[id] ?? piece.A!;
    out[id] = {
      fill: invertHex(p.fill),
      rim: invertHex(p.rim),
      edge: invertHex(p.edge),
    };
  }
  return out;
}

/** Programmatic dark palette: exact colour/opacity inversion of {@link LIGHT_THEME_TOKENS}. */
export function invertThemeTokens(light: ThemeTokens = LIGHT_THEME_TOKENS): ThemeTokens {
  return {
    table: invertHex(light.table),
    board: invertHex(light.board),
    lines: invertHex(light.lines),
    arenaSurface:
      light.arenaSurface === LIGHT_ARENA_SURFACE ? DARK_ARENA_SURFACE : LIGHT_ARENA_SURFACE,
    win: invertHex(light.win),
    runCelebration: invertHex(light.runCelebration),
    ghostOpacity: 1 - light.ghostOpacity,
    shadow: invertHex(light.shadow),
    piece: invertPieceColors(light.piece),
  };
}

function invertRgbaShadow(shadow: string): string {
  const m = shadow.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (!m) return shadow;
  const r = 255 - Number(m[1]);
  const g = 255 - Number(m[2]);
  const b = 255 - Number(m[3]);
  const a = m[4] !== undefined ? 1 - Number(m[4]) : 1;
  return shadow.replace(m[0], `rgba(${r}, ${g}, ${b}, ${a})`);
}

export function uiThemeTokens(id: ThemeId): UiThemeTokens {
  if (id === 'light') {
    return { ...LIGHT_UI_TOKENS };
  }
  return {
    pageText: invertHex(LIGHT_UI_TOKENS.pageText),
    pageBg: invertHex(LIGHT_UI_TOKENS.pageBg),
    gameBtnBorder: invertHex(LIGHT_UI_TOKENS.gameBtnBorder),
    gameBtnBg: invertHex(LIGHT_UI_TOKENS.gameBtnBg),
    gameBtnActive: invertHex(LIGHT_UI_TOKENS.gameBtnActive),
    gameBtnMuted: invertHex(LIGHT_UI_TOKENS.gameBtnMuted),
    gameMenuBorder: invertHex(LIGHT_UI_TOKENS.gameMenuBorder),
    gameMenuBg: invertHex(LIGHT_UI_TOKENS.gameMenuBg),
    gameMenuSeparator: invertHex(LIGHT_UI_TOKENS.gameMenuSeparator),
    gameMenuHover: invertHex(LIGHT_UI_TOKENS.gameMenuHover),
    gameMenuFocus: invertHex(LIGHT_UI_TOKENS.gameMenuFocus),
    actionButtonShadow: invertRgbaShadow(LIGHT_UI_TOKENS.actionButtonShadow),
    actionButtonShadowDark: invertRgbaShadow(LIGHT_UI_TOKENS.actionButtonShadowDark),
  };
}

/**
 * Which stored GLB variant (A = white / ivory, B = black) to show for a logical player.
 * Dark theme swaps white ↔ black models without retinting materials.
 */
export function pieceGlbSideForPlayer(themeId: ThemeId, player: string): 'A' | 'B' {
  const logical = player === 'B' ? 'B' : 'A';
  if (themeId === 'light') return logical;
  return logical === 'A' ? 'B' : 'A';
}

export function themeTokens(id: ThemeId): ThemeTokens {
  if (id === 'light') return LIGHT_THEME_TOKENS;
  return invertThemeTokens(LIGHT_THEME_TOKENS);
}

export const DEFAULT_PLAYERS: readonly string[] = PLAYERS;

export const THEME_STORAGE_KEY = 'abstract-three-theme';

export function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage disabled */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** `?theme=light|dark` URL override (screenshots, tests), else stored/system theme. */
export function readInitialTheme(): ThemeId {
  try {
    const q = new URLSearchParams(location.search).get('theme');
    if (q === 'light' || q === 'dark') return q;
  } catch {
    /* no location */
  }
  return readStoredTheme();
}

function applyUiCssVars(id: ThemeId): void {
  const ui = uiThemeTokens(id);
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
  root.style.setProperty(
    '--ui-action-button-shadow',
    id === 'light' ? LIGHT_UI_TOKENS.actionButtonShadow : ui.actionButtonShadowDark,
  );
  const scene = themeTokens(id);
  root.style.setProperty('--theme-win', scene.win);
  root.style.setProperty('--theme-win-rgb', hexToRgbCsv(scene.win));
}

function hexToRgbCsv(hex: string): string {
  const raw = expandHex(hex);
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/** Sets `data-theme` on the document root and applies inverted UI CSS variables. */
export function applyDocumentTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  if (typeof document !== 'undefined') applyUiCssVars(id);
}

export interface BindThemeToggleOptions {
  /** Follow OS dark/light changes while the user hasn't picked a theme. Default true. */
  followSystem?: boolean;
}

/**
 * Shared theme wiring: applies the initial theme, toggles on click, persists the
 * choice, and follows the OS preference until the user picks one.
 */
export function bindThemeToggle(
  button: HTMLElement,
  apply: (theme: ThemeId) => void,
  options: BindThemeToggleOptions = {},
): () => void {
  let theme = readInitialTheme();
  const set = (id: ThemeId) => {
    theme = id;
    applyDocumentTheme(id);
    apply(id);
  };
  set(theme);
  const onClick = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    storeTheme(next);
    set(next);
  };
  button.addEventListener('click', onClick);
  let unwatch = () => {};
  if (options.followSystem !== false) {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onSystem = () => {
        try {
          if (localStorage.getItem(THEME_STORAGE_KEY) === null) set(readInitialTheme());
        } catch {
          /* ignore */
        }
      };
      mq.addEventListener('change', onSystem);
      unwatch = () => mq.removeEventListener('change', onSystem);
    } catch {
      /* no matchMedia */
    }
  }
  return () => {
    button.removeEventListener('click', onClick);
    unwatch();
  };
}

export function storeTheme(id: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* optional */
  }
}
