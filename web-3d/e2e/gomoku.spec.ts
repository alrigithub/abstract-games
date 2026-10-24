import { expect, test } from '@playwright/test';
import { attachPageErrorCollectors, clickBoardFraction, waitForBoardCanvas } from './smoke-helpers';

test('gomoku smoke: canvas renders, no console errors, one human move', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = attachPageErrorCollectors(page);
  await waitForBoardCanvas(page, '/');
  await clickBoardFraction(page, 0.52, 0.52);
  await expect(page.locator('[data-testid="game-status"]')).toContainText(/thinking|AI to move/i, { timeout: 15_000 });
  await expect(page.locator('[data-testid="game-status"]')).toContainText(/Your turn|wins/i, { timeout: 30_000 });
  expect(errors, errors.join('\n')).toEqual([]);
});
