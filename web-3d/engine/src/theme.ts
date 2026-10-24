import type { BoardBuildContext, ThemeId, ThemeTokens } from './types';

export type { ThemeId, ThemeTokens };

const PLAYERS = ['A', 'B'] as const;

export const WIN_ACCENT = '#3b82f6';

/** GIPF-style printed boards built from live board materials (Tzaar topology, Yinsh hex grid). */
export function themeTokensFromBoardContext(ctx: BoardBuildContext): ThemeTokens {
  const board = `#${ctx.boardMaterial.color.getHexString()}`;
  const lines = `#${ctx.gridMaterial.color.getHexString()}`;
  return {
    table: board,
    board,
    lines,
    win: WIN_ACCENT,
    runCelebration: '#ffb347',
    ghostOpacity: 0.24,
    shadow: lines,
    piece: {},
  };
}

export function themeTokens(id: ThemeId): ThemeTokens {
  if (id === 'dark') {
    return {
      table: '#16171a',
      board: '#22242a',
      lines: '#8a8f98',
      win: WIN_ACCENT,
      runCelebration: '#ffb347',
      ghostOpacity: 0.28,
      shadow: '#3a4048',
      piece: {
        A: { fill: '#ffffff', rim: '#000000', edge: '#000000' },
        B: { fill: '#000000', rim: '#ffffff', edge: '#ffffff' },
      },
    };
  }
  return {
    table: '#f3f1ec',
    board: '#e8e4dc',
    lines: '#5c564c',
    win: WIN_ACCENT,
    runCelebration: '#ffb347',
    ghostOpacity: 0.24,
    shadow: '#19232e',
    piece: {
      A: { fill: '#ffffff', rim: '#000000', edge: '#000000' },
      B: { fill: '#000000', rim: '#ffffff', edge: '#ffffff' },
    },
  };
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

/** Sets `data-theme` on the document root. Every game page should go through this. */
export function applyDocumentTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
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
