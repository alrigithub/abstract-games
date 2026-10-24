import { test } from '@playwright/test';
import path from 'node:path';

const outDir = process.env.GROUNDING_SHOTS_DIR ?? path.join(process.cwd(), 'e2e', 'screenshots');

test('capture grounding close-ups', async ({ page }) => {
  await page.goto('/?human=ivory');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 60_000 });
  const menu = page.locator('[data-testid="main-menu"]');
  if (await menu.isVisible()) await page.click('[data-testid="mode-sandbox"]');
  await page.waitForTimeout(500);

  const pile = await page.evaluate(() => (window as unknown as { __takE2e: { pilePoint(): { x: number; y: number } } }).__takE2e.pilePoint());
  await page.screenshot({
    path: path.join(outDir, 'tak-grounding-reserve-closeup.png'),
    clip: { x: Math.max(0, pile.x - 120), y: Math.max(0, pile.y - 140), width: 240, height: 280 },
  });

  const center = await page.evaluate(() => (window as unknown as { __takE2e: { centerPoint(): { x: number; y: number } } }).__takE2e.centerPoint());
  await page.mouse.move(pile.x, pile.y);
  await page.mouse.down();
  await page.mouse.move(center.x, center.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  await page.screenshot({
    path: path.join(outDir, 'tak-grounding-board-stack-closeup.png'),
    clip: { x: Math.max(0, center.x - 120), y: Math.max(0, center.y - 160), width: 240, height: 320 },
  });
});
