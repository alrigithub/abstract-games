import { test } from '@playwright/test';
import path from 'node:path';

const outDir = path.join(process.cwd(), 'e2e', 'screenshots', 'shadow-lighting-before');

const games = [
  {
    name: 'tak',
    path: '/?human=ivory',
    setup: async (page: import('@playwright/test').Page) => {
      const menu = page.locator('[data-testid="main-menu"]');
      if (await menu.isVisible()) await page.click('[data-testid="mode-sandbox"]');
    },
  },
  { name: 'gomoku', path: '/' },
  {
    name: 'boop',
    path: '/',
    setup: async (page: import('@playwright/test').Page) => {
      await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
        timeout: 120_000,
      });
    },
  },
  { name: 'yinsh', path: '/?e2e=1' },
  {
    name: 'tzaar',
    path: '/?e2e=1',
    setup: async (page: import('@playwright/test').Page) => {
      await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
        timeout: 60_000,
      });
    },
  },
] as const;

async function ensureAxoCamera(page: import('@playwright/test').Page) {
  const toggle = page.locator('[data-testid="camera-toggle"]');
  if (!(await toggle.isVisible())) return;
  await page.evaluate(() => {
    const w = window as unknown as { __boopSetCameraPreset?: (p: 'axo') => void };
    if (w.__boopSetCameraPreset) {
      w.__boopSetCameraPreset('axo');
      return;
    }
    const btn = document.querySelector('[data-testid="camera-toggle"]') as HTMLButtonElement | null;
    if (btn && /top/i.test(btn.getAttribute('aria-label') ?? '')) btn.click();
  });
  await page.waitForTimeout(350);
}

for (const game of games) {
  test(`${game.name} shadow lighting iso (before baseline)`, async ({ page }) => {
    test.setTimeout(game.name === 'tak' ? 120_000 : 60_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => localStorage.setItem('abstract-three-theme', 'light'));
    const base = {
      tak: 'http://127.0.0.1:5190',
      gomoku: 'http://127.0.0.1:5192',
      boop: 'http://127.0.0.1:5194',
      yinsh: 'http://127.0.0.1:5196',
      tzaar: 'http://127.0.0.1:5199',
    }[game.name];
    await page.goto(`${base}${game.path}`);
    if (game.setup) await game.setup(page);
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 60_000 });
    await ensureAxoCamera(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, `${game.name}-iso-light.png`) });
  });
}
