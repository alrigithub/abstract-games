import { expect, test } from '@playwright/test';
import path from 'node:path';

const screenshotDir = path.join(process.cwd(), 'e2e', 'screenshots');

test.describe('Gomoku win glow', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`win-glow screenshot (${theme})`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto(`/?shot=win-glow&theme=${theme}`);
      await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
      await page.waitForTimeout(900);

      const count = await page.evaluate(() => {
        const fn = (window as unknown as { __gomokuWinGlowCount?: () => number }).__gomokuWinGlowCount;
        if (!fn) throw new Error('__gomokuWinGlowCount missing');
        return fn();
      });
      expect(count).toBe(5);
      await expect(page.locator('[data-testid="game-status"]')).toContainText(/Black wins/i);

      await page.screenshot({
        path: path.join(screenshotDir, `gomoku-win-glow-${theme}.png`),
        fullPage: true,
      });
    });
  }
});
