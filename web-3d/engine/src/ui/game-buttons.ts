import {
  createAiStrengthControl,
  type AiStrengthControl,
  type AiStrengthLevel,
  DEFAULT_AI_STRENGTH_LEVELS,
} from './ai-strength';
import type { CameraViewController } from '../camera-views';
import { bindThemeToggle, type ThemeId } from '../theme';
import { ensureBasePageStyles } from './page-styles';

/** Site root lobby (Firebase hosting). */
export const DEFAULT_LOBBY_HREF = '/';

/** Shared top-bar CSS; exported so tooling/tests can read the single source. */
export { GAME_BUTTONS_CSS };

const STYLE_ID = 'abstract-game-buttons-styles';

const GAME_BUTTONS_CSS = `
.game-button-bar {
  position: fixed;
  z-index: 20;
  top: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: min(100vw - 24px, 520px);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 0.8125rem;
}
.game-button-row {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 4px;
}
.game-button-bar button,
.game-button-bar a.game-button-link {
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid var(--game-btn-border, #ccc);
  border-radius: 6px;
  background: var(--game-btn-bg, #fff);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}
.game-button-bar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.game-button-bar button[aria-pressed="true"] {
  background: var(--game-btn-active, #e8e4dc);
}
.game-button-bar button.game-button-icon {
  min-width: 36px;
  padding: 0;
  font-size: 1.05rem;
}
:root[data-theme='dark'] .game-button-bar {
  --game-btn-border: #555;
  --game-btn-bg: #222;
  --game-btn-active: #333;
}
.game-button-ai-slot {
  display: inline-flex;
  align-items: center;
}
.ai-strength-inline .ai-strength-row {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.ai-strength-inline .ai-strength-step {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--game-btn-border, #ccc);
  border-radius: 6px;
  background: var(--game-btn-bg, #fff);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
}
.ai-strength-inline .ai-strength-value {
  min-width: 3.25rem;
  text-align: center;
  font-weight: 600;
  padding: 0 4px;
}
.game-button-status {
  margin: 0;
  padding: 4px 8px;
  font-size: 0.75rem;
  line-height: 1.3;
  color: var(--game-btn-muted, #555);
  max-width: 100%;
}
:root[data-theme='dark'] .game-button-status {
  --game-btn-muted: #aaa;
}
.game-button-popover {
  margin: 0;
  padding: 10px;
  border: 1px solid var(--game-btn-border, #ccc);
  border-radius: 8px;
  background: var(--game-btn-bg, #fff);
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  min-width: 200px;
}
.game-button-popover h2 {
  margin: 0 0 6px;
  font-size: 0.9rem;
  font-weight: 600;
}
.game-button-popover p {
  margin: 0 0 8px;
  font-size: 0.75rem;
  color: var(--game-btn-muted, #555);
}
.game-button-popover-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.game-button-popover-actions button {
  min-height: 36px;
  width: 100%;
}
`;

function ensureGameButtonStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = GAME_BUTTONS_CSS;
  document.head.append(style);
}

export interface FirstPlayerChoice {
  label: string;
  id: string;
  testId: string;
}

export interface ExtraGameButton {
  label: string;
  testId: string;
  onClick: () => void;
  title?: string;
  ariaLabel?: string;
  className?: string;
}

export interface CreateGameButtonsOptions {
  /** Game-specific buttons appended to the shared row (e.g. Yinsh "Flip run"). */
  extraButtons?: ExtraGameButton[];
  /** Inject the shared page shell CSS (default true). */
  basePageStyles?: boolean;
  mount?: HTMLElement;
  lobbyHref?: string;
  /** When set, shows the shared AI strength stepper in the bar. */
  aiStrengthStorageKey?: string;
  aiStrengthLevels?: AiStrengthLevel[];
  onAiStrengthChange?: (level: AiStrengthLevel) => void;
  /** Gomoku default: human black or white after New game. */
  onFirstPlayerSelected?: (color: 'black' | 'white') => void;
  /** Override popover copy, choices, and handler (e.g. Tak ivory/charcoal). */
  firstPlayer?: {
    title?: string;
    description?: string;
    choices: FirstPlayerChoice[];
    onSelect: (id: string) => void;
  };
  /** Demo/sandbox: New game resets immediately (no first-player popover). */
  onNewGameReset?: () => void;
  /** When set, adds a theme toggle button using {@link bindThemeToggle}. */
  applyTheme?: (theme: ThemeId) => void;
  /** Alias for {@link applyTheme}. */
  onThemeChange?: (theme: ThemeId) => void;
  /** Shared top / ¾ camera presets; adds the Camera button when set. */
  cameraViews?: CameraViewController;
  fullscreenElement?: HTMLElement;
}

export interface GameButtonsBar {
  root: HTMLElement;
  aiStrength: AiStrengthControl | null;
  setStatus(text: string): void;
  openNewGamePopover(): void;
  destroy(): void;
}

export function createGameButtons(options: CreateGameButtonsOptions): GameButtonsBar {
  if (options.basePageStyles !== false) ensureBasePageStyles();
  ensureGameButtonStyles();
  const mount = options.mount ?? document.body;
  const fullscreenEl = options.fullscreenElement ?? document.documentElement;
  const themeApply = options.applyTheme ?? options.onThemeChange;
  const usesFirstPlayerPopover = !options.onNewGameReset && (options.firstPlayer != null || options.onFirstPlayerSelected != null);

  const root = document.createElement('div');
  root.className = 'game-button-bar';
  root.dataset.testid = 'game-button-bar';

  const row = document.createElement('div');
  row.className = 'game-button-row';

  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.type = 'button';
  fullscreenBtn.dataset.testid = 'fullscreen-toggle';
  fullscreenBtn.setAttribute('aria-label', 'Toggle full screen');
  fullscreenBtn.textContent = 'Full screen';

  let unbindTheme: (() => void) | undefined;
  const themeBtn = document.createElement('button');
  themeBtn.type = 'button';
  themeBtn.className = 'game-button-icon';
  themeBtn.id = 'theme-toggle';
  themeBtn.dataset.testid = 'theme-toggle';
  themeBtn.setAttribute('aria-label', 'Toggle theme');
  themeBtn.title = 'Toggle theme';
  themeBtn.textContent = '◐';
  if (themeApply) {
    unbindTheme = bindThemeToggle(themeBtn, themeApply);
  }

  const cameraBtn = document.createElement('button');
  cameraBtn.type = 'button';
  cameraBtn.className = 'game-button-icon';
  cameraBtn.dataset.testid = 'camera-toggle';
  cameraBtn.setAttribute('aria-label', 'Toggle camera view');
  cameraBtn.title = 'Camera: top view and ¾ view';
  cameraBtn.textContent = '⌖';
  let unbindCamera: (() => void) | undefined;
  if (options.cameraViews) {
    const onCamera = () => options.cameraViews!.toggle();
    cameraBtn.addEventListener('click', onCamera);
    unbindCamera = () => cameraBtn.removeEventListener('click', onCamera);
  }

  const newGameBtn = document.createElement('button');
  newGameBtn.type = 'button';
  newGameBtn.dataset.testid = 'new-game';
  newGameBtn.textContent = 'New game';

  const aiSlot = document.createElement('div');
  aiSlot.className = 'game-button-ai-slot';
  if (!options.aiStrengthStorageKey) aiSlot.hidden = true;

  const lobby = document.createElement('a');
  lobby.className = 'game-button-link';
  lobby.href = options.lobbyHref ?? DEFAULT_LOBBY_HREF;
  lobby.dataset.testid = 'back-to-lobby';
  lobby.textContent = 'Back to Lobby';

  const extras = (options.extraButtons ?? []).map(extra => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.testid = extra.testId;
    btn.textContent = extra.label;
    if (extra.title) btn.title = extra.title;
    if (extra.ariaLabel) btn.setAttribute('aria-label', extra.ariaLabel);
    if (extra.className) btn.className = extra.className;
    btn.addEventListener('click', () => extra.onClick());
    return btn;
  });

  row.append(
    fullscreenBtn,
    ...(options.cameraViews ? [cameraBtn] : []),
    ...(themeApply ? [themeBtn] : []),
    newGameBtn,
    aiSlot,
    lobby,
    ...extras,
  );

  const status = document.createElement('p');
  status.className = 'game-button-status';
  status.dataset.testid = 'game-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  root.append(row, status);
  mount.append(root);

  let aiStrength: AiStrengthControl | null = null;
  if (options.aiStrengthStorageKey) {
    aiStrength = createAiStrengthControl({
      container: aiSlot,
      storageKey: options.aiStrengthStorageKey,
      levels: options.aiStrengthLevels,
      layout: 'inline',
      onChange: level => options.onAiStrengthChange?.(level),
    });
  }

  const popover = document.createElement('div');
  popover.className = 'game-button-popover';
  popover.dataset.testid = 'first-player-popover';
  popover.hidden = true;
  if (usesFirstPlayerPopover) {
    const firstTitle = options.firstPlayer?.title ?? 'Who goes first?';
    const firstDescription = options.firstPlayer?.description ?? 'You vs AI — pick your color.';
    popover.innerHTML = `<h2></h2><p></p><div class="game-button-popover-actions"></div>`;
    popover.querySelector('h2')!.textContent = firstTitle;
    popover.querySelector('p')!.textContent = firstDescription;
    const actions = popover.querySelector('.game-button-popover-actions')!;
    const choices =
      options.firstPlayer?.choices ??
      ([
        { label: 'You · Black', id: 'black', testId: 'first-black' },
        { label: 'You · White', id: 'white', testId: 'first-white' },
      ] satisfies FirstPlayerChoice[]);
    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = choice.label;
      btn.dataset.first = choice.id;
      btn.dataset.testid = choice.testId;
      btn.addEventListener('click', () => {
        popover.hidden = true;
        if (options.firstPlayer) options.firstPlayer.onSelect(choice.id);
        else options.onFirstPlayerSelected?.(choice.id as 'black' | 'white');
      });
      actions.append(btn);
    }
    root.append(popover);
  }

  const syncFullscreenLabel = () => {
    const active = document.fullscreenElement === fullscreenEl;
    fullscreenBtn.setAttribute('aria-pressed', String(active));
    fullscreenBtn.textContent = active ? 'Exit full screen' : 'Full screen';
  };

  fullscreenBtn.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === fullscreenEl) await document.exitFullscreen();
      else await fullscreenEl.requestFullscreen();
    } catch {
      /* unsupported */
    }
  });
  document.addEventListener('fullscreenchange', syncFullscreenLabel);
  syncFullscreenLabel();

  const openNewGamePopover = () => {
    if (usesFirstPlayerPopover) popover.hidden = false;
  };

  if (options.onNewGameReset) {
    newGameBtn.addEventListener('click', () => options.onNewGameReset!());
  } else {
    newGameBtn.addEventListener('click', openNewGamePopover);
  }

  const onDocClick = (event: MouseEvent) => {
    if (!usesFirstPlayerPopover || popover.hidden) return;
    const target = event.target as Node;
    if (!popover.contains(target) && target !== newGameBtn) popover.hidden = true;
  };
  document.addEventListener('click', onDocClick);

  return {
    root,
    aiStrength,
    setStatus(text: string) {
      status.textContent = text;
    },
    openNewGamePopover,
    destroy() {
      document.removeEventListener('fullscreenchange', syncFullscreenLabel);
      document.removeEventListener('click', onDocClick);
      unbindTheme?.();
      unbindCamera?.();
      options.cameraViews?.dispose();
      aiStrength?.destroy();
      root.remove();
    },
  };
}

export { DEFAULT_AI_STRENGTH_LEVELS };
