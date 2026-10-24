import { expect, test } from '@playwright/test';
import path from 'node:path';
import { openGameMenu } from './game-menu';

const screenshotDir = path.join(process.cwd(), 'e2e', 'screenshots');

async function waitBoard(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 60_000 });
  await page.waitForTimeout(500);
}

test.describe('Gomoku 3D', () => {
  test('shared game button bar is present', async ({ page }) => {
    await waitBoard(page);
    await expect(page.locator('[data-testid="game-button-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-menu-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="camera-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="fullscreen-toggle"]')).toBeVisible();
    await openGameMenu(page);
    await expect(page.locator('[data-testid="new-game"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-strength"]')).toBeVisible();
    await expect(page.locator('[data-testid="back-to-lobby"]')).toBeVisible();
    await expect(page.locator('.sandbox-header')).toHaveCount(0);
  });

  test('changing AI strength updates depth sent to worker', async ({ page }) => {
    test.setTimeout(90_000);
    await waitBoard(page);
    await openGameMenu(page);
    await expect(page.locator('[data-testid="ai-strength-label"]')).toHaveText('Medium');
    await page.click('[data-testid="ai-strength-increase"]');
    await expect(page.locator('[data-testid="ai-strength-label"]')).toHaveText('Hard');
    await page.keyboard.press('Escape');
    const board = page.locator('[data-testid="board"]');
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + box!.width * 0.52, box!.y + box!.height * 0.52);
    await expect.poll(() => page.locator('body').getAttribute('data-last-ai-depth')).toBe('6');
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/Your turn/i, { timeout: 30_000 });
    await openGameMenu(page);
    await page.click('[data-testid="ai-strength-decrease"]');
    await page.click('[data-testid="ai-strength-decrease"]');
    await expect(page.locator('[data-testid="ai-strength-label"]')).toHaveText('Easy');
    await page.keyboard.press('Escape');
    await page.mouse.click(box!.x + box!.width * 0.48, box!.y + box!.height * 0.48);
    await expect.poll(() => page.locator('body').getAttribute('data-last-ai-depth')).toBe('2', { timeout: 15_000 });
  });

  test('New game clears the board', async ({ page }) => {
    test.setTimeout(90_000);
    await waitBoard(page);
    const board = page.locator('[data-testid="board"]');
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + box!.width * 0.52, box!.y + box!.height * 0.52);
    await expect.poll(() => page.locator('body').getAttribute('data-stone-count')).not.toBe('0');
    await openGameMenu(page);
    await page.click('[data-testid="new-game"]');
    await expect(page.locator('[data-testid="first-player-popover"]')).toBeVisible();
    await page.click('[data-testid="first-black"]');
    await expect.poll(() => page.locator('body').getAttribute('data-stone-count')).toBe('0');
  });

  test('human places a stone and AI replies', async ({ page }) => {
    test.setTimeout(90_000);
    await waitBoard(page);
    const board = page.locator('[data-testid="board"]');
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    const cx = box!.x + box!.width * 0.52;
    const cy = box!.y + box!.height * 0.52;
    await page.mouse.click(cx, cy);
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/AI (Easy|Medium|Hard|Expert)/i);
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/thinking|AI to move/i, { timeout: 15_000 });
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/Your turn|wins/i, { timeout: 30_000 });
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`screenshot (${theme})`, async ({ page }) => {
      await page.addInitScript(themeId => {
        localStorage.setItem('abstract-three-theme', themeId);
      }, theme);
      await waitBoard(page);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(screenshotDir, `gomoku-${theme}.png`), fullPage: true });
    });
  }
});
