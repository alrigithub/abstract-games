/**
 * Shared full-viewport page shell for every 3D game: root colours per theme,
 * box-sizing, and a full-size `#app` / `.viewport` / `#board`.
 * Injected by {@link createGameButtons}; games keep only game-specific CSS.
 */
const STYLE_ID = 'abstract-page-styles';

export const BASE_PAGE_CSS = `
:root {
  font-family: system-ui, -apple-system, sans-serif;
  color: #1a1a1a;
  background: #f3f1ec;
}
:root[data-theme='dark'] {
  color: #e8e8e8;
  background: #16171a;
}
* { box-sizing: border-box; }
html, body, #app {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
#app { position: fixed; inset: 0; }
.viewport, #board {
  width: 100%;
  height: 100%;
  touch-action: none;
}
#board { position: relative; }
`;

export function ensureBasePageStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = BASE_PAGE_CSS;
  // Prepend so game stylesheets can still override.
  document.head.prepend(style);
}
