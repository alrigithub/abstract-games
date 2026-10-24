import { expect, test } from '@playwright/test';
import { attachPageErrorCollectors, waitForBoardCanvas } from './smoke-helpers';

test('boop smoke: canvas renders, no console errors, one human move', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = attachPageErrorCollectors(page);
  await waitForBoardCanvas(page, '/');
  await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
    timeout: 120_000,
  });
  await page.waitForFunction(() => window.__boopSmokePickAndPlace != null, null, { timeout: 15_000 });
  await page.evaluate(async () => window.__boopSmokePickAndPlace!());
  await expect(page.locator('[data-testid="game-status"]')).toContainText(/AI thinking/i, { timeout: 20_000 });
  await page.waitForFunction(() => window.__boopController!.canInteract(), null, { timeout: 45_000 });
  await expect(page.locator('[data-testid="game-status"]')).not.toContainText(/AI thinking/i);
  expect(errors, errors.join('\n')).toEqual([]);
});
