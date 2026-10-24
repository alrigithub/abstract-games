import { test } from '@playwright/test';
import path from 'node:path';

const screenshotDir = path.join(process.cwd(), 'e2e', 'screenshots');

test.describe('Yinsh move assist screenshots', () => {
  test('ring selected with legal destinations', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://127.0.0.1:5196/?shot=assist-ring-dest&theme=light');
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(screenshotDir, 'yinsh-assist-ring-destinations.png'),
      fullPage: false,
    });
  });

  test('hover path with flip preview', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://127.0.0.1:5196/?shot=assist-path-flip&theme=light');
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(screenshotDir, 'yinsh-assist-path-flip.png'),
      fullPage: false,
    });
  });

  test('five-marker row selection', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://127.0.0.1:5196/?shot=assist-run-pick&theme=light');
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(screenshotDir, 'yinsh-assist-run-pick.png'),
      fullPage: false,
    });
  });

  test('AI last move highlight', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://127.0.0.1:5196/?shot=assist-ai-move&theme=dark');
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(screenshotDir, 'yinsh-assist-ai-last-move.png'),
      fullPage: false,
    });
  });
});
