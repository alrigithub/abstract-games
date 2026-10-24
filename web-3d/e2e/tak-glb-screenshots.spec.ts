import { expect, test } from '@playwright/test';
import path from 'node:path';

const screenshotDir = path.join(process.cwd(), 'e2e', 'screenshots');

async function sandboxBoard(page: import('@playwright/test').Page) {
  await page.goto('/?human=ivory');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
  await page.waitForTimeout(800);
  const menu = page.locator('[data-testid="main-menu"]');
  if (await menu.isVisible()) {
    await page.click('[data-testid="mode-sandbox"]');
    await page.waitForTimeout(400);
  }
}

test.describe('Tak GLB screenshots', () => {
  test('flats, wall, capstones, stack', async ({ page }) => {
    test.setTimeout(120_000);
    await sandboxBoard(page);

    await page.evaluate(() => {
      (window as unknown as { __takE2e: { seedGlbDemo(): void } }).__takE2e.seedGlbDemo();
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotDir, 'tak-glb-board.png'), fullPage: true });

    const mid = await page.evaluate(() =>
      (window as unknown as { __takE2e: { centerPoint(): { x: number; y: number } } }).__takE2e.centerPoint(),
    );
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, 'tak-glb-stack-close.png'), fullPage: true });
  });
});
