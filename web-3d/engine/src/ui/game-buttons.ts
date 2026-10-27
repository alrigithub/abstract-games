import {
  createAiStrengthControl,
  type AiStrengthControl,
  type AiStrengthLevel,
  DEFAULT_AI_STRENGTH_LEVELS,
} from './ai-strength';
import type { CameraViewController } from '../camera-views';
import { nextCameraPresetAfter } from '../camera-views';
import { applyDocumentTheme } from '../theme';
import { ensureBasePageStyles } from './page-styles';
import { initPlaceSfx, isPlaceSoundEnabled, readPlaceSoundEnabled, setPlaceSoundEnabled } from '../sound/place-sfx';
import {
  createActionIcon,
  createCameraToolbarIcon,
  createFullscreenToolbarIcon,
  createMenuIcon,
  type MenuIconName,
} from './menu-icons';

/**
 * Hub page beside each game in the staged hosting tree (`index.html`, games in `<name>/`).
 * Relative so GitHub Pages / subdirectory hosts resolve correctly (absolute `/` is the host root, not the hub).
 */
export const DEFAULT_LOBBY_HREF = '../index.html';

/**
 * Default lobby URL for the current deploy. Prefer resolving against `document.location`
 * so dev and published builds behave the same; fall back to {@link DEFAULT_LOBBY_HREF}.
 */
export function resolveDefaultLobbyHref(): string {
  if (typeof document !== 'undefined' && document.location?.href) {
    try {
      return new URL(DEFAULT_LOBBY_HREF, document.location.href).href;
    } catch {
      return DEFAULT_LOBBY_HREF;
    }
  }
  return DEFAULT_LOBBY_HREF;
}

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
  align-items: flex-start;
  gap: 0;
  max-width: min(100vw - 24px, 520px);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 0.8125rem;
}
.game-button-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}
.game-button-menu-trigger {
  min-width: 36px;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid var(--game-btn-border, #d4d4d8);
  border-radius: 8px;
  background: var(--game-btn-bg, #fff);
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 1.25rem;
  line-height: 1;
  letter-spacing: 0.08em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.game-button-menu-trigger[aria-expanded="true"] {
  background: var(--game-btn-active, #f4f4f5);
}
.game-button-menu-trigger:focus-visible,
.game-menu-item:focus-visible,
.game-button-toolbar-btn:focus-visible,
.game-action-button:focus-visible {
  outline: 2px solid var(--game-menu-focus, #2563eb);
  outline-offset: 2px;
}
.game-button-toolbar-btn {
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  border: 1px solid var(--game-btn-border, #d4d4d8);
  border-radius: 8px;
  background: var(--game-btn-bg, #fff);
  color: inherit;
  cursor: pointer;
  font: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.game-action-bar {
  position: fixed;
  z-index: 20;
  left: 50%;
  bottom: max(16px, env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  max-width: min(100vw - 24px, 520px);
  padding: 0 max(12px, env(safe-area-inset-right, 0px)) 0 max(12px, env(safe-area-inset-left, 0px));
  pointer-events: none;
}
.game-action-bar > * {
  pointer-events: auto;
}
@media (min-width: 900px) {
  .game-action-bar {
    left: auto;
    right: max(16px, env(safe-area-inset-right, 0px));
    transform: none;
    justify-content: flex-end;
  }
}
.game-action-button {
  min-width: 48px;
  min-height: 48px;
  padding: 0 18px;
  border: 1px solid var(--game-btn-border, #d4d4d8);
  border-radius: 12px;
  background: var(--game-btn-bg, #fff);
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: var(--ui-action-button-shadow, 0 4px 16px rgba(0, 0, 0, 0.08));
}
.game-action-button.game-button-icon {
  min-width: 48px;
  padding: 0;
  font-size: 1.25rem;
}
.game-button-status {
  margin: 0;
  padding: 0;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--game-btn-muted, #71717a);
  flex: 1 1 8rem;
  min-width: 0;
}
.game-menu-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 220px;
  max-width: min(100vw - 24px, 280px);
  padding: 6px;
  margin: 0;
  border: 1px solid var(--game-menu-border, #e4e4e7);
  border-radius: 10px;
  background: var(--game-menu-bg, #fff);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.06);
  list-style: none;
}
.game-menu-dropdown[hidden] {
  display: none !important;
}
.game-menu-separator {
  height: 0;
  margin: 4px 8px;
  border: none;
  border-top: 1px solid var(--game-menu-separator, #ececec);
}
.game-menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 8px 10px;
  margin: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  text-decoration: none;
  box-sizing: border-box;
}
.game-menu-item:hover,
.game-menu-item:focus-visible {
  background: var(--game-menu-hover, #f4f4f5);
}
.game-menu-icon {
  flex-shrink: 0;
  opacity: 0.85;
}
.game-menu-label {
  flex: 1;
  min-width: 0;
}
.game-menu-ai-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 4px 10px;
  border-radius: 6px;
}
.game-menu-ai-row .ai-strength-inline {
  flex: 1;
  min-width: 0;
}
.game-menu-ai-row .ai-strength-inline .ai-strength-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  width: 100%;
}
.game-menu-ai-row .ai-strength-step {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--game-btn-border, #d4d4d8);
  border-radius: 6px;
  background: var(--game-btn-bg, #fff);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  color: inherit;
}
.game-menu-ai-row .ai-strength-step:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.game-menu-ai-row .ai-strength-value {
  min-width: 3.5rem;
  text-align: center;
  font-weight: 600;
  font-size: 0.8125rem;
}
.game-menu-ai-title {
  font-size: 0.8125rem;
  color: var(--game-btn-muted, #71717a);
  white-space: nowrap;
}
.game-button-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  margin: 0;
  padding: 10px;
  border: 1px solid var(--game-menu-border, #e4e4e7);
  border-radius: 10px;
  background: var(--game-menu-bg, #fff);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  min-width: 200px;
  z-index: 1;
}
.game-button-popover[hidden] {
  display: none !important;
}
.game-button-popover h2 {
  margin: 0 0 6px;
  font-size: 0.9rem;
  font-weight: 600;
}
.game-button-popover p {
  margin: 0 0 8px;
  font-size: 0.75rem;
  color: var(--game-btn-muted, #71717a);
}
.game-button-popover-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.game-button-popover-actions button {
  min-height: 36px;
  width: 100%;
  border: 1px solid var(--game-btn-border, #d4d4d8);
  border-radius: 6px;
  background: var(--game-btn-bg, #fff);
  cursor: pointer;
  font: inherit;
}
`;

function ensureGameButtonStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = GAME_BUTTONS_CSS;
  document.head.append(style);
}

function cameraPresetLabel(preset: 'top' | 'axo'): string {
  return preset === 'top' ? 'Top view' : '¾ view';
}

export interface FirstPlayerChoice {
  label: string;
  id: string;
  testId: string;
}

export interface GameActionButton {
  label: string;
  testId: string;
  onClick: () => void;
  title?: string;
  ariaLabel?: string;
  className?: string;
  icon?: MenuIconName;
}

/** @deprecated Use {@link GameActionButton} and {@link CreateGameButtonsOptions.gameActions}. */
export type ExtraGameButton = GameActionButton;

export interface CreateGameButtonsOptions {
  /** Game-specific touch actions (bottom action bar). */
  gameActions?: GameActionButton[];
  /** @deprecated Use {@link gameActions}. */
  extraButtons?: GameActionButton[];
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
  /** Restart the current round with the same mode and settings (no start dialog). Falls back to {@link onNewGameReset}. */
  onRestartRound?: () => void;
  /** Shared top / ¾ camera presets; adds the Camera button when set. */
  cameraViews?: CameraViewController;
  fullscreenElement?: HTMLElement;
}

export interface GameButtonsBar {
  root: HTMLElement;
  /** Bottom game action bar, or null when no actions were provided. */
  actionsRoot: HTMLElement | null;
  aiStrength: AiStrengthControl | null;
  setStatus(text: string): void;
  openNewGamePopover(): void;
  /** Runs the restart-round handler (same as the menu item). */
  restartRound(): void;
  /** Opens the ⋯ dropdown (for tests and programmatic access). */
  openMenu(): void;
  closeMenu(): void;
  destroy(): void;
}

function createMenuItem(options: {
  testId?: string;
  icon: MenuIconName;
  label: string;
  href?: string;
  onActivate?: () => void;
  closeOnActivate?: boolean;
}): HTMLElement {
  const el = options.href
    ? (document.createElement('a') as HTMLAnchorElement)
    : document.createElement('button');
  el.className = 'game-menu-item';
  el.setAttribute('role', 'menuitem');
  el.tabIndex = -1;
  if (options.testId) el.dataset.testid = options.testId;
  if (options.href) {
    (el as HTMLAnchorElement).href = options.href;
  } else {
    (el as HTMLButtonElement).type = 'button';
  }
  el.append(createMenuIcon(options.icon, options.label));
  const span = document.createElement('span');
  span.className = 'game-menu-label';
  span.textContent = options.label;
  el.append(span);
  el.addEventListener('click', () => {
    options.onActivate?.();
    if (options.closeOnActivate !== false) {
      el.dispatchEvent(new CustomEvent('game-menu-close', { bubbles: true }));
    }
  });
  return el;
}

export function createGameButtons(options: CreateGameButtonsOptions): GameButtonsBar {
  if (options.basePageStyles !== false) {
    ensureBasePageStyles();
    applyDocumentTheme();
  }
  ensureGameButtonStyles();
  initPlaceSfx();
  const mount = options.mount ?? document.body;
  const fullscreenEl = options.fullscreenElement ?? document.documentElement;
  const usesFirstPlayerPopover = !options.onNewGameReset && (options.firstPlayer != null || options.onFirstPlayerSelected != null);

  const root = document.createElement('div');
  root.className = 'game-button-bar';
  root.dataset.testid = 'game-button-bar';

  const toolbar = document.createElement('div');
  toolbar.className = 'game-button-toolbar';

  const menuTrigger = document.createElement('button');
  menuTrigger.type = 'button';
  menuTrigger.className = 'game-button-menu-trigger';
  menuTrigger.dataset.testid = 'game-menu-toggle';
  menuTrigger.setAttribute('aria-label', 'Game menu');
  menuTrigger.setAttribute('aria-haspopup', 'menu');
  menuTrigger.setAttribute('aria-expanded', 'false');
  menuTrigger.title = 'Menu';
  menuTrigger.textContent = '⋯';

  const status = document.createElement('p');
  status.className = 'game-button-status';
  status.dataset.testid = 'game-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const cameraBtn = document.createElement('button');
  cameraBtn.type = 'button';
  cameraBtn.className = 'game-button-toolbar-btn';
  cameraBtn.dataset.testid = 'camera-toggle';
  cameraBtn.setAttribute('aria-label', 'Camera view');
  if (!options.cameraViews) cameraBtn.hidden = true;

  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.type = 'button';
  fullscreenBtn.className = 'game-button-toolbar-btn';
  fullscreenBtn.dataset.testid = 'fullscreen-toggle';
  fullscreenBtn.setAttribute('aria-label', 'Enter full screen');

  toolbar.append(menuTrigger, ...(options.cameraViews ? [cameraBtn] : []), fullscreenBtn, status);

  const menu = document.createElement('div');
  menu.className = 'game-menu-dropdown';
  menu.dataset.testid = 'game-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Game menu');
  menu.hidden = true;

  const newGameBtn = createMenuItem({
    testId: 'new-game',
    icon: 'plus',
    label: 'New game',
    closeOnActivate: false,
  });

  const restartRoundHandler = options.onRestartRound ?? options.onNewGameReset;
  const restartRoundBtn = createMenuItem({
    testId: 'restart-round',
    icon: 'rotate-ccw',
    label: 'Restart round',
    closeOnActivate: true,
    onActivate: () => restartRoundHandler?.(),
  });
  if (!restartRoundHandler) restartRoundBtn.hidden = true;

  const aiSlot = document.createElement('div');
  aiSlot.className = 'game-menu-ai-row';
  aiSlot.setAttribute('role', 'none');
  if (!options.aiStrengthStorageKey) aiSlot.hidden = true;
  else {
    const aiTitle = document.createElement('span');
    aiTitle.className = 'game-menu-ai-title';
    aiTitle.textContent = 'AI';
    aiSlot.append(aiTitle);
  }

  let soundEnabled = readPlaceSoundEnabled();
  const soundBtn = createMenuItem({
    testId: 'sound-toggle',
    icon: 'volume-2',
    label: 'Sound on',
    closeOnActivate: true,
  });

  const lobby = createMenuItem({
    testId: 'back-to-lobby',
    icon: 'arrow-left',
    label: 'Back to Lobby',
    href: options.lobbyHref ?? resolveDefaultLobbyHref(),
    closeOnActivate: true,
  });

  const gameActions = [...(options.gameActions ?? []), ...(options.extraButtons ?? [])];

  menu.append(newGameBtn, restartRoundBtn);
  if (options.aiStrengthStorageKey) menu.append(aiSlot);
  menu.append(document.createElement('hr'));
  menu.lastElementChild!.className = 'game-menu-separator';
  menu.append(soundBtn);
  menu.append(document.createElement('hr'));
  menu.lastElementChild!.className = 'game-menu-separator';
  menu.append(lobby);

  root.append(toolbar, menu);
  mount.append(root);

  let actionsRoot: HTMLElement | null = null;
  if (gameActions.length) {
    actionsRoot = document.createElement('div');
    actionsRoot.className = 'game-action-bar';
    actionsRoot.dataset.testid = 'game-action-bar';
    for (const action of gameActions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'game-action-button';
      if (action.className) btn.classList.add(action.className);
      btn.dataset.testid = action.testId;
      if (action.icon) btn.append(createActionIcon(action.icon));
      const label = document.createElement('span');
      label.textContent = action.label;
      if (action.icon && action.className?.includes('game-button-icon')) {
        label.hidden = true;
      }
      btn.append(label);
      if (action.title) btn.title = action.title;
      btn.setAttribute('aria-label', action.ariaLabel ?? action.label);
      btn.addEventListener('click', () => action.onClick());
      actionsRoot.append(btn);
    }
    document.body.append(actionsRoot);
  }

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
        closeMenu();
        if (options.firstPlayer) options.firstPlayer.onSelect(choice.id);
        else options.onFirstPlayerSelected?.(choice.id as 'black' | 'white');
      });
      actions.append(btn);
    }
    root.append(popover);
  }

  const menuItems = (): HTMLElement[] =>
    Array.from(menu.querySelectorAll<HTMLElement>('.game-menu-item:not([hidden])'));

  const syncFullscreenControl = () => {
    const active = document.fullscreenElement === fullscreenEl;
    fullscreenBtn.setAttribute('aria-pressed', String(active));
    fullscreenBtn.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen');
    fullscreenBtn.title = active ? 'Exit full screen' : 'Full screen';
    fullscreenBtn.replaceChildren(createFullscreenToolbarIcon(active));
  };

  const syncCameraControl = () => {
    if (!options.cameraViews) return;
    const next = nextCameraPresetAfter(options.cameraViews.preset);
    const label = `Camera · ${cameraPresetLabel(next)}`;
    cameraBtn.title = label;
    cameraBtn.setAttribute('aria-label', label);
    cameraBtn.replaceChildren(createCameraToolbarIcon());
  };

  const syncSoundLabel = () => {
    soundEnabled = isPlaceSoundEnabled();
    const label = menu.querySelector<HTMLElement>('[data-testid="sound-toggle"] .game-menu-label');
    const iconHost = menu.querySelector<HTMLElement>('[data-testid="sound-toggle"] .game-menu-icon');
    const text = soundEnabled ? 'Sound on' : 'Sound off';
    if (label) label.textContent = text;
    if (iconHost) {
      iconHost.replaceWith(createMenuIcon(soundEnabled ? 'volume-2' : 'volume-x', text));
    }
    soundBtn.setAttribute('aria-pressed', String(soundEnabled));
  };

  let menuOpen = false;
  const closeMenu = () => {
    if (!menuOpen) return;
    menuOpen = false;
    menu.hidden = true;
    menuTrigger.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    if (menuOpen) return;
    menuOpen = true;
    menu.hidden = false;
    menuTrigger.setAttribute('aria-expanded', 'true');
    syncSoundLabel();
    const items = menuItems();
    if (items[0]) items[0].focus();
  };

  menu.addEventListener('game-menu-close', () => closeMenu());

  soundBtn.addEventListener('click', () => {
    setPlaceSoundEnabled(!isPlaceSoundEnabled());
    syncSoundLabel();
  });
  syncSoundLabel();

  let unbindCamera: (() => void) | undefined;
  if (options.cameraViews) {
    const onCamera = () => {
      options.cameraViews!.toggle();
      syncCameraControl();
    };
    cameraBtn.addEventListener('click', onCamera);
    unbindCamera = () => cameraBtn.removeEventListener('click', onCamera);
    syncCameraControl();
  }

  fullscreenBtn.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === fullscreenEl) await document.exitFullscreen();
      else await fullscreenEl.requestFullscreen();
    } catch {
      /* unsupported */
    }
  });
  document.addEventListener('fullscreenchange', syncFullscreenControl);
  syncFullscreenControl();

  menuTrigger.addEventListener('click', e => {
    e.stopPropagation();
    if (menuOpen) closeMenu();
    else openMenu();
  });

  const openNewGamePopover = () => {
    closeMenu();
    if (usesFirstPlayerPopover) popover.hidden = false;
  };

  if (options.onNewGameReset) {
    newGameBtn.addEventListener('click', () => {
      closeMenu();
      options.onNewGameReset!();
    });
  } else {
    newGameBtn.addEventListener('click', () => {
      closeMenu();
      openNewGamePopover();
    });
  }

  const onDocClick = (event: MouseEvent) => {
    const target = event.target as Node;
    if (menuOpen && !root.contains(target)) closeMenu();
    if (usesFirstPlayerPopover && !popover.hidden) {
      if (!popover.contains(target) && !newGameBtn.contains(target)) popover.hidden = true;
    }
  };
  document.addEventListener('click', onDocClick);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (menuOpen) {
        event.preventDefault();
        closeMenu();
        menuTrigger.focus();
      }
      if (usesFirstPlayerPopover && !popover.hidden) popover.hidden = true;
      return;
    }
    if (!menuOpen) {
      if (event.key === 'ArrowDown' && document.activeElement === menuTrigger) {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    const items = menuItems();
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = items[(idx + 1 + items.length) % items.length];
      next?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = items[(idx - 1 + items.length) % items.length];
      next?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // Stepper clicks must not close the menu.
  aiSlot.addEventListener('click', e => e.stopPropagation());

  return {
    root,
    actionsRoot,
    aiStrength,
    setStatus(text: string) {
      status.textContent = text;
    },
    openNewGamePopover,
    restartRound() {
      closeMenu();
      restartRoundHandler?.();
    },
    openMenu,
    closeMenu,
    destroy() {
      document.removeEventListener('fullscreenchange', syncFullscreenControl);
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
      unbindCamera?.();
      options.cameraViews?.dispose();
      aiStrength?.destroy();
      actionsRoot?.remove();
      root.remove();
    },
  };
}

export { DEFAULT_AI_STRENGTH_LEVELS };
