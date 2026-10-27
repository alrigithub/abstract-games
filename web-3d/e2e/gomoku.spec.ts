import { expect, test } from '@playwright/test';
import { attachPageErrorCollectors, clickBoardFraction, waitForBoardCanvas } from './smoke-helpers';

test('gomoku smoke: canvas renders, no console errors, one human move', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = attachPageErrorCollectors(page);
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await waitForBoardCanvas(page, '/');
  await expect(page.locator('[data-testid="camera-toggle"]')).toBeVisible();
  await clickBoardFraction(page, 0.5, 0.5);
  await expect(page.locator('[data-testid="game-status"]')).toContainText(/thinking|AI to move/i, { timeout: 15_000 });
  await expect(page.locator('[data-testid="game-status"]')).toContainText(/Your turn|wins/i, { timeout: 30_000 });
  expect(requests.some(url => url.endsWith('gomoku-columns.glb') || url.endsWith('gomoku-light.webp'))).toBe(false);
  expect(requests.some(url => url.endsWith('go-map.glb') || url.endsWith('boop-map.glb'))).toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});
