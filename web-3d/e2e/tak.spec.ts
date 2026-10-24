import { expect, test } from '@playwright/test';
import path from 'node:path';

const screenshotDir = path.join(process.cwd(), 'e2e', 'screenshots');

async function waitBoard(page: import('@playwright/test').Page, dismiss: 'sandbox' | false = 'sandbox') {
  await page.goto('/?human=ivory');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 60_000 });
  await page.waitForTimeout(400);
  if (dismiss === 'sandbox') {
    const menu = page.locator('[data-testid="main-menu"]');
    if (await menu.isVisible()) {
      await page.click('[data-testid="mode-sandbox"]');
      await page.waitForTimeout(300);
    }
  }
}

async function boardCenter(page: import('@playwright/test').Page) {
  const board = page.locator('[data-testid="board"]');
  const box = await board.boundingBox();
  expect(box).toBeTruthy();
  return { board, box: box! };
}

test.describe('Tak 3D', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`renders and interacts (${theme})`, async ({ page }) => {
      await waitBoard(page);
      if (theme === 'dark') {
        await page.click('[data-testid="theme-toggle"]');
        await page.waitForTimeout(200);
      }
      await page.screenshot({ path: path.join(screenshotDir, `tak-${theme}-initial.png`), fullPage: true });

      const { box } = await boardCenter(page);
      const cx = box.x + box.width * 0.5;
      const cy = box.y + box.height * 0.5;
      const reserveX = box.x + box.width * 0.12;
      const reserveY = box.y + box.height * 0.45;

      await page.mouse.click(reserveX, reserveY);
      await page.waitForTimeout(250);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(screenshotDir, `tak-${theme}-tray-place.png`), fullPage: true });

      await page.mouse.click(cx, cy);
      await page.waitForTimeout(200);
      await page.mouse.click(cx + 36, cy);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(screenshotDir, `tak-${theme}-stack.png`), fullPage: true });

      const rotate = page.locator('[data-testid="rotate-piece"]');
      if (await rotate.isVisible()) {
        await rotate.click();
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: path.join(screenshotDir, `tak-${theme}-flip.png`), fullPage: true });
    });
  }

  test('AI responds without extra click after end turn', async ({ page }) => {
    test.setTimeout(60_000);
    await waitBoard(page, false);
    await page.locator('[data-testid="mode-ai"]').click();
    await expect(page.locator('[data-testid="game-status"]')).toBeVisible();
    const { box } = await boardCenter(page);
    await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.52);
    await expect(page.locator('[data-testid="end-turn"]')).toBeEnabled({ timeout: 10_000 });
    await page.click('[data-testid="end-turn"]');
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/thinking|to move|wins/i, { timeout: 20_000 });
    await page.screenshot({ path: path.join(screenshotDir, 'tak-ai-reply.png'), fullPage: true });
  });
});
