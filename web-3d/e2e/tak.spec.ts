import { expect, test } from '@playwright/test';
import path from 'node:path';
import { openGameMenu } from './game-menu';

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

type Pt = { x: number; y: number };

async function boardBox(page: import('@playwright/test').Page) {
  const board = page.locator('[data-testid="board"]');
  const box = await board.boundingBox();
  expect(box).toBeTruthy();
  return { board, box: box! };
}

function screenPoint(box: { x: number; y: number; width: number; height: number }, p: Pt) {
  return { x: box.x + p.x, y: box.y + p.y };
}

async function dragBoard(page: import('@playwright/test').Page, box: { x: number; y: number }, from: Pt, to: Pt) {
  const a = screenPoint(box, from);
  const b = screenPoint(box, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 14 });
  await page.waitForTimeout(80);
  await page.mouse.up();
}

test.describe('Tak 3D', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`hold-drag sandbox (${theme})`, async ({ page }) => {
      await waitBoard(page);
      if (theme === 'dark') {
        await openGameMenu(page);
        await page.click('[data-testid="theme-toggle"]');
        await page.waitForTimeout(200);
      }
      await page.screenshot({ path: path.join(screenshotDir, `tak-${theme}-initial.png`), fullPage: true });

      const pilePt = await page.evaluate(() => (window as unknown as { __takE2e: { pilePoint(): { x: number; y: number } } }).__takE2e.pilePoint());
      const centerPt = await page.evaluate(() => (window as unknown as { __takE2e: { centerPoint(): { x: number; y: number } } }).__takE2e.centerPoint());
      const stackTarget = { x: centerPt.x + 36, y: centerPt.y };
      await page.mouse.move(pilePt.x, pilePt.y);
      await page.mouse.down();
      await expect(page.locator('[data-testid="selection-info"]')).toBeVisible({ timeout: 2000 });
      await expect(page.locator('#selection-label')).toHaveText(/^[2-9]/, { timeout: 4000 });
      await page.mouse.move(pilePt.x + 40, pilePt.y + 40, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(screenshotDir, `tak-${theme}-hold-grow.png`), fullPage: true });

      await page.mouse.move(pilePt.x, pilePt.y);
      await page.mouse.down();
      await page.mouse.move(centerPt.x, centerPt.y, { steps: 14 });
      await page.waitForTimeout(80);
      await page.mouse.up();
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(screenshotDir, `tak-${theme}-tray-place.png`), fullPage: true });

      await page.mouse.move(centerPt.x, centerPt.y);
      await page.mouse.down();
      await page.mouse.move(stackTarget.x, stackTarget.y, { steps: 14 });
      await page.waitForTimeout(80);
      await page.mouse.up();
      await page.waitForTimeout(450);
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
    const reserve = await page.evaluate(() =>
      (window as unknown as { __takE2e: { openingReservePoint(): { x: number; y: number } } }).__takE2e.openingReservePoint(),
    );
    const center = await page.evaluate(() =>
      (window as unknown as { __takE2e: { centerPoint(): { x: number; y: number } } }).__takE2e.centerPoint(),
    );
    await page.mouse.move(reserve.x, reserve.y);
    await page.mouse.down();
    await page.mouse.move(center.x, center.y, { steps: 14 });
    await page.waitForTimeout(80);
    await page.mouse.up();
    await expect(page.locator('[data-testid="end-turn"]')).toBeEnabled({ timeout: 10_000 });
    await page.click('[data-testid="end-turn"]');
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/thinking|to move|wins/i, { timeout: 20_000 });
    await page.screenshot({ path: path.join(screenshotDir, 'tak-ai-reply.png'), fullPage: true });
  });
});
