/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCameraViewController } from '../camera-views';
import * as THREE from 'three';
import {
  createGameButtons,
  DEFAULT_LOBBY_HREF,
  resolveDefaultLobbyHref,
} from './game-buttons';

describe('resolveDefaultLobbyHref', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses a path relative to the hub layout', () => {
    expect(DEFAULT_LOBBY_HREF).toBe('../index.html');
  });

  it('resolves to the hub index from a published game path', () => {
    vi.stubGlobal('document', {
      location: { href: 'https://example.github.io/abstract-games/tak/index.html' },
    });
    expect(resolveDefaultLobbyHref()).toBe('https://example.github.io/abstract-games/index.html');
  });

  it('resolves from Firebase-style /tak/ deploy when the hub is the host root', () => {
    vi.stubGlobal('document', {
      location: { href: 'https://my-game.web.app/tak/index.html' },
    });
    expect(resolveDefaultLobbyHref()).toBe('https://my-game.web.app/index.html');
  });

  it('falls back when document is unavailable', () => {
    vi.stubGlobal('document', undefined);
    expect(resolveDefaultLobbyHref()).toBe('../index.html');
  });
});

describe('createGameButtons menu', () => {
  let mount: HTMLDivElement;

  beforeEach(() => {
    mount = document.createElement('div');
    document.body.append(mount);
    document.documentElement.dataset.theme = 'light';
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
  });

  afterEach(() => {
    mount.remove();
    document.querySelectorAll('[data-testid="game-button-bar"]').forEach(el => el.remove());
    document.querySelectorAll('[data-testid="game-action-bar"]').forEach(el => el.remove());
    document.getElementById('abstract-game-buttons-styles')?.remove();
    document.getElementById('abstract-page-styles')?.remove();
  });

  it('opens and closes the dropdown from the trigger', () => {
    const bar = createGameButtons({ mount, basePageStyles: false });
    const menu = mount.querySelector('[data-testid="game-menu"]') as HTMLElement;
    const trigger = mount.querySelector('[data-testid="game-menu-toggle"]') as HTMLButtonElement;
    expect(menu.hidden).toBe(true);
    trigger.click();
    expect(menu.hidden).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    bar.closeMenu();
    expect(menu.hidden).toBe(true);
    bar.destroy();
  });

  it('keeps common menu control test ids in the DOM', () => {
    const bar = createGameButtons({
      mount,
      basePageStyles: false,
      aiStrengthStorageKey: 'test-ai-key',
      onNewGameReset: () => {},
    });
    bar.openMenu();
    expect(mount.querySelector('[data-testid="new-game"]')).toBeTruthy();
    expect(mount.querySelector('[data-testid="restart-round"]')).toBeTruthy();
    expect(mount.querySelector('[data-testid="ai-strength"]')).toBeTruthy();
    expect(mount.querySelector('[data-testid="theme-toggle"]')).toBeNull();
    expect(mount.querySelector('[data-testid="sound-toggle"]')).toBeTruthy();
    expect(mount.querySelector('[data-testid="back-to-lobby"]')).toBeTruthy();
    expect(mount.querySelector('[data-testid="fullscreen-toggle"]')).toBeTruthy();
    expect(mount.querySelector('[data-testid="game-menu"]')!.querySelector('[data-testid="fullscreen-toggle"]')).toBeNull();
    expect(mount.querySelector('[data-testid="game-menu"]')!.querySelector('[data-testid="camera-toggle"]')).toBeNull();
    bar.destroy();
  });

  it('renders game actions in the bottom action bar', () => {
    const bar = createGameButtons({
      mount,
      basePageStyles: false,
      onNewGameReset: () => {},
      gameActions: [{ label: 'Flip', testId: 'flip-action', onClick: () => {} }],
    });
    expect(document.querySelector('[data-testid="game-action-bar"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="flip-action"]')).toBeTruthy();
    expect(mount.querySelector('[data-testid="flip-action"]')).toBeNull();
    bar.destroy();
  });

  it('toggles placement sound preference from the menu', () => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem() {},
      clear() {
        this.store = {};
      },
    });
    const bar = createGameButtons({ mount, basePageStyles: false });
    bar.openMenu();
    const btn = mount.querySelector('[data-testid="sound-toggle"]') as HTMLButtonElement;
    expect(btn.querySelector('.game-menu-label')!.textContent).toBe('Sound on');
    btn.click();
    expect(localStorage.getItem('abstract-three-place-sound')).toBe('off');
    expect(btn.querySelector('.game-menu-label')!.textContent).toBe('Sound off');
    bar.destroy();
    vi.unstubAllGlobals();
  });

  it('invokes onRestartRound from the menu item', () => {
    const onRestartRound = vi.fn();
    const bar = createGameButtons({
      mount,
      basePageStyles: false,
      onRestartRound,
    });
    bar.openMenu();
    (mount.querySelector('[data-testid="restart-round"]') as HTMLButtonElement).click();
    expect(onRestartRound).toHaveBeenCalledTimes(1);
    bar.destroy();
  });

  it('falls back to onNewGameReset for restart round', () => {
    const onNewGameReset = vi.fn();
    const bar = createGameButtons({
      mount,
      basePageStyles: false,
      onNewGameReset,
    });
    bar.restartRound();
    expect(onNewGameReset).toHaveBeenCalledTimes(1);
    bar.destroy();
  });

  it('hides restart round when no handler is provided', () => {
    const bar = createGameButtons({
      mount,
      basePageStyles: false,
      onFirstPlayerSelected: () => {},
    });
    bar.openMenu();
    const restart = mount.querySelector('[data-testid="restart-round"]') as HTMLElement;
    expect(restart.hidden).toBe(true);
    bar.destroy();
  });

  it('camera toolbar label reflects the next preset', () => {
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    const controls = { target: new THREE.Vector3(), update: () => {} } as never;
    const views = createCameraViewController({
      camera,
      controls,
      getBounds: () => [new THREE.Vector3()],
      getAspect: () => 1,
      applyInitial: false,
    });
    const bar = createGameButtons({
      mount,
      basePageStyles: false,
      cameraViews: views,
      onNewGameReset: () => {},
    });
    const btn = mount.querySelector('[data-testid="camera-toggle"]') as HTMLButtonElement;
    expect(btn.title).toMatch(/Camera · Top view/);
    bar.destroy();
  });
});
