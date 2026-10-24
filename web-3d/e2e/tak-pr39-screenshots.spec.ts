import { expect, test } from '@playwright/test';
import path from 'node:path';
import { openGameMenu } from './game-menu';

const screenshotDir = path.join(process.cwd(), 'e2e', 'screenshots');

async function sandboxBoard(page: import('@playwright/test').Page) {
  await page.goto('/?human=ivory');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 60_000 });
  await page.waitForTimeout(400);
  const menu = page.locator('[data-testid="main-menu"]');
  if (await menu.isVisible()) {
    await page.click('[data-testid="mode-sandbox"]');
    await page.waitForTimeout(300);
  }
}

test.describe('Tak PR39 screenshots', () => {
  test('capture drag shadow, capstone grounding, flip bar', async ({ page }) => {
    test.setTimeout(90_000);
    await sandboxBoard(page);

    const pilePt = await page.evaluate(() =>
      (window as unknown as { __takE2e: { pilePoint(): { x: number; y: number } } }).__takE2e.pilePoint(),
    );
    const centerPt = await page.evaluate(() =>
      (window as unknown as { __takE2e: { centerPoint(): { x: number; y: number } } }).__takE2e.centerPoint(),
    );

    await page.mouse.move(pilePt.x, pilePt.y);
    await page.mouse.down();
    await page.mouse.move(centerPt.x, centerPt.y, { steps: 16 });
    await page.waitForTimeout(120);
    await page.screenshot({
      path: path.join(screenshotDir, 'tak-pr39-drag-shadow-only.png'),
      fullPage: true,
    });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const capPt = await page.evaluate(() =>
      (window as unknown as { __takE2e: { capReservePoint(): { x: number; y: number } } }).__takE2e.capReservePoint(),
    );
    const placeTarget = { x: centerPt.x + 48, y: centerPt.y - 24 };
    await page.mouse.move(capPt.x, capPt.y);
    await page.mouse.down();
    await page.mouse.move(placeTarget.x, placeTarget.y, { steps: 14 });
    await page.waitForTimeout(80);
    await page.mouse.up();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotDir, 'tak-pr39-capstone-board.png'),
      fullPage: true,
    });

    await page.evaluate(() =>
      (window as unknown as { __takE2e: { seedCapStackDemo(): void } }).__takE2e.seedCapStackDemo(),
    );
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(screenshotDir, 'tak-pr39-capstone-stack.png'),
      fullPage: true,
    });

    await openGameMenu(page);
    await page.click('[data-testid="new-game"]');
    await page.click('[data-testid="first-ivory"]');
    await expect(page.locator('[data-testid="game-status"]')).toBeVisible();
    const reserve = await page.evaluate(() =>
      (window as unknown as { __takE2e: { openingReservePoint(): { x: number; y: number } } }).__takE2e.openingReservePoint(),
    );
    for (let i = 0; i < 2; i++) {
      const target = { x: centerPt.x + i * 40, y: centerPt.y + 20 };
      await page.mouse.move(reserve.x, reserve.y);
      await page.mouse.down();
      await page.mouse.move(target.x, target.y, { steps: 12 });
      await page.waitForTimeout(80);
      await page.mouse.up();
      await expect(page.locator('[data-testid="end-turn"]')).toBeEnabled({ timeout: 10_000 });
      await page.click('[data-testid="end-turn"]');
      await page.waitForTimeout(i === 0 ? 2500 : 800);
    }
    await expect(page.locator('[data-testid="flip-stone"]')).toBeVisible({ timeout: 15_000 });
    await page.click('[data-testid="flip-stone"]');
    await page.screenshot({
      path: path.join(screenshotDir, 'tak-pr39-flip-button.png'),
      fullPage: true,
    });
  });
});
