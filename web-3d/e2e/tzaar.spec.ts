import { expect, test } from '@playwright/test';
import { attachPageErrorCollectors, waitForBoardCanvas } from './smoke-helpers';

test('tzaar smoke: canvas renders, no console errors, one human move', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = attachPageErrorCollectors(page);
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await waitForBoardCanvas(page, '/?e2e=1');
  await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
    timeout: 60_000,
  });
  await page.waitForFunction(() => (window as unknown as { __tzaarE2e?: unknown }).__tzaarE2e, null, {
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    const w = window as unknown as {
      __tzaarE2e: {
        firstLegalMove: () => unknown;
        applyMove: (m: unknown) => void;
        waitForSettled: () => Promise<void>;
      };
    };
    const move = w.__tzaarE2e.firstLegalMove();
    if (!move) throw new Error('no legal move');
    w.__tzaarE2e.applyMove(move);
    await w.__tzaarE2e.waitForSettled();
  });
  await expect(page.locator('[data-testid="game-status"]')).toContainText(/AI|Your turn|wins|thinking|Tap/i, {
    timeout: 30_000,
  });
  expect(requests.some(url => /\/lib\/maps\//.test(url) || url.endsWith('yinsh-map.glb') || url.endsWith('tzaar-map.glb'))).toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});
