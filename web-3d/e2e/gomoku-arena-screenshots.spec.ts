import { expect, test } from '@playwright/test';
import path from 'node:path';

const screenshotDir = path.join(process.cwd(), 'e2e', 'screenshots');

async function waitBoard(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
  await page.waitForTimeout(800);
}

test.describe('Gomoku arena screenshots', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`empty board (${theme})`, async ({ page }) => {
      await page.addInitScript(themeId => {
        localStorage.setItem('abstract-three-theme', themeId);
      }, theme);
      await waitBoard(page);
      await page.screenshot({
        path: path.join(screenshotDir, `gomoku-arena-empty-${theme}.png`),
        fullPage: true,
      });
    });
  }

  test('stones and win glow (light)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('abstract-three-theme', 'light');
    });
    await page.goto('/?shot=win-glow');
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
    await page.waitForTimeout(1200);
    await expect.poll(() => page.locator('body').getAttribute('data-demo-shot')).toBe('win-glow');
    await page.screenshot({
      path: path.join(screenshotDir, 'gomoku-arena-win-light.png'),
      fullPage: true,
    });
  });

  test('mid-game stones (light)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('abstract-three-theme', 'light');
    });
    await page.goto('/?shot=mid-stones&theme=light');
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
    await page.waitForTimeout(1200);
    await expect.poll(() => page.locator('body').getAttribute('data-demo-shot')).toBe('mid-stones');
    await page.screenshot({
      path: path.join(screenshotDir, 'gomoku-arena-mid-light.png'),
      fullPage: true,
    });
  });

  test('few stones (dark)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('abstract-three-theme', 'dark');
    });
    await waitBoard(page);
    const board = page.locator('[data-testid="board"]');
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.waitForTimeout(600);
    await page.mouse.click(box!.x + box!.width * 0.46, box!.y + box!.height * 0.48);
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(screenshotDir, 'gomoku-arena-stones-dark.png'),
      fullPage: true,
    });
  });
});
