import { expect, test } from '@playwright/test';
import path from 'node:path';

const screenshotDir = path.join(process.cwd(), 'e2e', 'screenshots');

async function waitBoard(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 60_000 });
  await page.waitForTimeout(500);
}

test.describe('Gomoku 3D', () => {
  test('changing AI strength updates depth sent to worker', async ({ page }) => {
    test.setTimeout(90_000);
    await waitBoard(page);
    await expect(page.locator('[data-testid="ai-strength-label"]')).toHaveText('Medium');
    await page.click('[data-testid="ai-strength-increase"]');
    await expect(page.locator('[data-testid="ai-strength-label"]')).toHaveText('Hard');
    const board = page.locator('[data-testid="board"]');
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + box!.width * 0.52, box!.y + box!.height * 0.52);
    await expect.poll(() => page.locator('body').getAttribute('data-last-ai-depth')).toBe('6');
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/Your turn/i, { timeout: 30_000 });
    await page.click('[data-testid="ai-strength-decrease"]');
    await page.click('[data-testid="ai-strength-decrease"]');
    await expect(page.locator('[data-testid="ai-strength-label"]')).toHaveText('Easy');
    await page.mouse.click(box!.x + box!.width * 0.48, box!.y + box!.height * 0.48);
    await expect.poll(() => page.locator('body').getAttribute('data-last-ai-depth')).toBe('2', { timeout: 15_000 });
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
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/thinking|White|AI/i, { timeout: 15_000 });
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/Your turn|wins/i, { timeout: 30_000 });
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`screenshot (${theme})`, async ({ page }) => {
      await waitBoard(page);
      if (theme === 'dark') {
        await page.click('[data-testid="theme-toggle"]');
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: path.join(screenshotDir, `gomoku-${theme}.png`), fullPage: true });
    });
  }
});
