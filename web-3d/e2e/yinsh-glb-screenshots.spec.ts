import { expect, test } from '@playwright/test';
import path from 'node:path';
import { openGameMenu } from './game-menu';

const screenshotDir = path.join(process.cwd(), 'e2e', 'screenshots');

test.describe('Yinsh stone GLB screenshots', () => {
  test('ring close-up via shot URL', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://127.0.0.1:5196/?shot=ring-closeup&theme=light');
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: path.join(screenshotDir, 'yinsh-glb-ring-marker-closeup.png'),
      fullPage: false,
    });
  });

  test('dark theme during AI game', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      localStorage.setItem('abstract-yinsh-ai-strength', '0');
    });
    await page.goto('http://127.0.0.1:5196/?e2e=1&theme=light');
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
    await page.waitForFunction(() => (window as unknown as { __yinshE2e?: unknown }).__yinshE2e, undefined, {
      timeout: 60_000,
    });
    await page.waitForTimeout(2000);
    await openGameMenu(page);
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(screenshotDir, 'yinsh-glb-dark-theme.png'),
      fullPage: false,
    });
  });
});
