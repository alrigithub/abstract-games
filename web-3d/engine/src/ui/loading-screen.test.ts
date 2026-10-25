/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { createLoadingScreen, setActiveLoadingScreen } from './loading-screen';

describe('loading-screen', () => {
  afterEach(() => {
    setActiveLoadingScreen(null);
    document.getElementById('abstract-loading-overlay')?.remove();
    document.getElementById('abstract-loading-screen-styles')?.remove();
  });

  it('tracks async steps and removes overlay after done()', async () => {
    const screen = createLoadingScreen({ gameName: 'Test' });
    setActiveLoadingScreen(screen);
    const overlay = document.querySelector('[data-testid="loading-overlay"]');
    expect(overlay).toBeTruthy();

    await screen.track(Promise.resolve(1), 'Step A');
    await screen.done();

    expect(document.querySelector('[data-testid="loading-overlay"]')).toBeNull();
  });

  it('keeps overlay visible after fail()', async () => {
    const screen = createLoadingScreen({ gameName: 'Test' });
    await expect(
      screen.track(Promise.reject(new Error('nope')), 'bad-asset.glb'),
    ).rejects.toThrow('nope');
    await screen.done();
    const overlay = document.querySelector('[data-testid="loading-overlay"]');
    expect(overlay).toBeTruthy();
    expect(overlay?.textContent).toMatch(/Failed/);
  });
});
