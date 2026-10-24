import { expect, test } from '@playwright/test';
import { attachPageErrorCollectors, waitForBoardCanvas } from './smoke-helpers';

test('tak smoke: canvas renders, no console errors, one human move', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = attachPageErrorCollectors(page);
  await waitForBoardCanvas(page, '/?human=ivory');
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
  await expect(page.locator('[data-testid="game-status"]')).toContainText(/thinking|to move|wins|AI/i, {
    timeout: 20_000,
  });
  expect(errors, errors.join('\n')).toEqual([]);
});
