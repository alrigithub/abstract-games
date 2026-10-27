import { expect, test } from '@playwright/test';
import { attachPageErrorCollectors, waitForBoardCanvas } from './smoke-helpers';

test('yinsh smoke: canvas renders, no console errors, one human move', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = attachPageErrorCollectors(page);
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await waitForBoardCanvas(page, '/?e2e=1');
  await page.waitForFunction(() => (window as unknown as { __yinshE2e?: unknown }).__yinshE2e, null, {
    timeout: 60_000,
  });
  const move = await page.evaluate(() =>
    (window as unknown as { __yinshE2e: { suggestMove: () => unknown } }).__yinshE2e.suggestMove(),
  );
  expect(move).toBeTruthy();
  await page.evaluate(m => (window as unknown as { __yinshE2e: { applyMove: (mv: unknown) => void } }).__yinshE2e.applyMove(m), move);
  await page.evaluate(() =>
    (window as unknown as { __yinshE2e: { waitForSettled: () => Promise<void> } }).__yinshE2e.waitForSettled(),
  );
  await expect.poll(async () =>
    page.evaluate(() => (window as unknown as { __yinshE2e: { aiPending: () => boolean } }).__yinshE2e.aiPending()),
  ).toBe(false);
  expect(requests.some(url => /\/lib\/maps\//.test(url) || url.endsWith('yinsh-map.glb') || url.endsWith('tzaar-map.glb'))).toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});
