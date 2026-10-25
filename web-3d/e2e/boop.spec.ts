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
  await page.waitForFunction(() => !window.__boopController!.canInteract(), null, { timeout: 20_000 });
  await page.waitForFunction(() => window.__boopController!.canInteract(), null, { timeout: 45_000 });
  await expect(page.locator('[data-testid="boop-thumb-control"]')).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Boop pre-render stays registered when resized and ignores camera gestures', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = attachPageErrorCollectors(page);
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await waitForBoardCanvas(page, '/?theme=light');
  await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true');
  await expect(page.locator('[data-testid="camera-toggle"]')).toHaveCount(0);
  const before = await page.evaluate(() => window.__boopScene!.cellScreen(0));
  await page.mouse.move(before.x, before.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(before.x + 80, before.y + 40);
  await page.mouse.up({ button: 'right' });
  await page.mouse.wheel(0, 250);
  expect(await page.evaluate(() => window.__boopScene!.cellScreen(0))).toEqual(before);
  for (const viewport of [{ width: 1440, height: 810 }, { width: 600, height: 900 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__boopScene!;
      return Array.from({ length: 36 }, (_, i) => {
        const p = scene.cellScreen(i);
        return { cell: i, hit: scene.hitTest(p.x, p.y) };
      }).filter(result => result.cell !== result.hit);
    })).toEqual([]);
  }
  await page.evaluate(() => window.__boopSetTheme!('dark'));
  await page.evaluate(() => window.__boopSetTheme!('light'));
  expect(requests.some(url => url.endsWith('boop-columns.glb'))).toBe(true);
  expect(requests.some(url => url.endsWith('boop-map.glb'))).toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});
