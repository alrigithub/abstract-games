/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { createGameButtons } from './game-buttons';
import { createCameraViewController } from '../camera-views';
import * as THREE from 'three';

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
      applyTheme: () => {},
      onNewGameReset: () => {},
    });
    bar.openMenu();
    expect(mount.querySelector('[data-testid="new-game"]')).toBeTruthy();
    expect(mount.querySelector('[data-testid="ai-strength"]')).toBeTruthy();
    expect(mount.querySelector('[data-testid="theme-toggle"]')).toBeTruthy();
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
