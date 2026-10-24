import { test } from '@playwright/test';
import path from 'node:path';
import { openGameMenu } from './game-menu';

const outDir = path.join(process.cwd(), 'e2e', 'screenshots', 'game-menu');

async function waitBoard(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 60_000 });
  await page.waitForTimeout(400);
}

const setups = [
  {
    name: 'gomoku',
    baseURL: 'http://127.0.0.1:5192',
    setup: async (page: import('@playwright/test').Page) => {
      await page.goto('http://127.0.0.1:5192/');
      await waitBoard(page);
    },
  },
  {
    name: 'tak',
    baseURL: 'http://127.0.0.1:5190',
    setup: async (page: import('@playwright/test').Page) => {
      await page.goto('http://127.0.0.1:5190/?human=ivory');
      await waitBoard(page);
      const menu = page.locator('[data-testid="main-menu"]');
      if (await menu.isVisible()) await page.click('[data-testid="mode-sandbox"]');
    },
  },
] as const;

const viewports = [
  { tag: 'desktop', width: 1280, height: 720 },
  { tag: 'tablet-landscape', width: 1024, height: 768 },
  { tag: 'tablet-portrait', width: 820, height: 1180 },
] as const;

for (const game of setups) {
  for (const theme of ['light', 'dark'] as const) {
    for (const vp of viewports) {
      test(`${game.name} menu ${theme} ${vp.tag}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.addInitScript(themeId => {
          localStorage.setItem('abstract-three-theme', themeId);
        }, theme);
        await game.setup(page);
        await openGameMenu(page);
        await page.waitForTimeout(200);
        await page.locator('[data-testid="game-menu"]').screenshot({
          path: path.join(outDir, `${game.name}-menu-${theme}-${vp.tag}.png`),
        });
        await page.screenshot({
          path: path.join(outDir, `${game.name}-chrome-${theme}-${vp.tag}.png`),
          fullPage: false,
        });
      });
    }
  }
}
