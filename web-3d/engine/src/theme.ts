import type { ThemeId, ThemeTokens } from './types';

export type { ThemeId, ThemeTokens };

const PLAYERS = ['A', 'B'] as const;

export const WIN_ACCENT = '#3b82f6';

export function themeTokens(id: ThemeId): ThemeTokens {
  if (id === 'dark') {
    return {
      table: '#16171a',
      board: '#22242a',
      lines: '#8a8f98',
      win: WIN_ACCENT,
      ghostOpacity: 0.28,
      shadow: '#000000',
      piece: {
        A: { fill: '#f5f5f5', rim: '#2a2a2a', edge: '#2a2a2a' },
        B: { fill: '#111111', rim: '#d8d8d8', edge: '#d8d8d8' },
      },
    };
  }
  return {
    table: '#f3f1ec',
    board: '#e8e4dc',
    lines: '#5c564c',
    win: WIN_ACCENT,
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

export function bindThemeToggle(button: HTMLElement, apply: (theme: ThemeId) => void): () => void {
  let theme = readStoredTheme();
  apply(theme);
  document.documentElement.dataset.theme = theme;
  const onClick = () => {
    theme = theme === 'light' ? 'dark' : 'light';
    storeTheme(theme);
    apply(theme);
    document.documentElement.dataset.theme = theme;
  };
  button.addEventListener('click', onClick);
  return () => button.removeEventListener('click', onClick);
}

export function storeTheme(id: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* optional */
  }
}
