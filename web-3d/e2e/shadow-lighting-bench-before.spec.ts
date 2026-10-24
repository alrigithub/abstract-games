import { expect, test } from '@playwright/test';

/** Baseline frame time at parent commit (no ?bench=1 hook). */
const games = [
  {
    name: 'tak',
    url: 'http://127.0.0.1:5190/?human=ivory',
    setup: async (page: import('@playwright/test').Page) => {
      const sandbox = page.locator('[data-testid="mode-sandbox"]');
      if (await sandbox.isVisible()) await sandbox.click();
    },
  },
  { name: 'gomoku', url: 'http://127.0.0.1:5192/' },
  { name: 'boop', url: 'http://127.0.0.1:5194/', ready: true },
  { name: 'yinsh', url: 'http://127.0.0.1:5196/?e2e=1' },
  { name: 'tzaar', url: 'http://127.0.0.1:5199/?e2e=1', ready: true },
] as const;

async function avgFrameMs(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(async () => {
    let total = 0;
    const n = 24;
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      total += performance.now() - t0;
    }
    return total / n;
  });
}

for (const game of games) {
  test(`${game.name} baseline rAF frame time (before)`, async ({ page }) => {
    await page.goto(game.url);
    if (game.setup) await game.setup(page);
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 120_000 });
    if (game.ready) {
      await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
        timeout: 120_000,
      });
    }
    await page.waitForTimeout(400);
    const ms = await avgFrameMs(page);
    expect(Number.isFinite(ms)).toBe(true);
    await test.info().attach(`${game.name}-before-frame-ms`, {
      body: Buffer.from(JSON.stringify({ game: game.name, avgFrameMs: ms, method: 'rAF' }, null, 2)),
      contentType: 'application/json',
    });
    console.log(`[bench-before] ${game.name}=${ms.toFixed(2)}ms`);
  });
}
