import { test } from '@playwright/test';
import path from 'node:path';

const outDir = path.join(process.cwd(), 'e2e', 'screenshots', 'unified-lighting');
const theme = 'light';

const games = [
  { name: 'tak', url: 'http://127.0.0.1:5190/?human=ivory' },
  { name: 'gomoku', url: 'http://127.0.0.1:5192/' },
  { name: 'boop', url: 'http://127.0.0.1:5194/' },
  { name: 'yinsh', url: 'http://127.0.0.1:5196/' },
  { name: 'tzaar', url: 'http://127.0.0.1:5199/' },
] as const;

async function waitBoard(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 60_000 });
  await page.waitForTimeout(600);
}

for (const game of games) {
  test(`${game.name} unified lighting (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(themeId => {
      localStorage.setItem('abstract-three-theme', themeId);
    }, theme);
    await page.goto(game.url);
    if (game.name === 'tak') {
      const menu = page.locator('[data-testid="main-menu"]');
      if (await menu.isVisible()) await page.click('[data-testid="mode-sandbox"]');
    }
    if (game.name === 'boop') {
      await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
        timeout: 60_000,
      });
    }
    await waitBoard(page);
    await page.screenshot({
      path: path.join(outDir, `${game.name}-${theme}.png`),
      fullPage: false,
    });
  });
}
