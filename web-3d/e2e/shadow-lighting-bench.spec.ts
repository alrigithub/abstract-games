import { expect, test } from '@playwright/test';

const games = [
  { name: 'tak', url: 'http://127.0.0.1:5190/?human=ivory&bench=1', setup: async (page: import('@playwright/test').Page) => {
      const menu = page.locator('[data-testid="main-menu"]');
      if (await menu.isVisible()) await page.click('[data-testid="mode-ai"]');
    } },
  { name: 'gomoku', url: 'http://127.0.0.1:5192/?bench=1' },
  { name: 'boop', url: 'http://127.0.0.1:5194/?bench=1', ready: true },
  { name: 'yinsh', url: 'http://127.0.0.1:5196/?e2e=1&bench=1' },
  { name: 'tzaar', url: 'http://127.0.0.1:5199/?e2e=1&bench=1', ready: true },
] as const;

async function avgFrameMs(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(async () => {
    const bench = (window as unknown as { __benchOneFrame?: () => number }).__benchOneFrame;
    const n = 24;
    if (bench) {
      let total = 0;
      for (let i = 0; i < n; i++) total += bench();
      return total / n;
    }
    let total = 0;
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      total += performance.now() - t0;
    }
    return total / n;
  });
}

for (const game of games) {
  test(`${game.name} single-frame render time`, async ({ page }) => {
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
    await test.info().attach(`${game.name}-frame-ms`, {
      body: Buffer.from(JSON.stringify({ game: game.name, avgFrameMs: ms }, null, 2)),
      contentType: 'application/json',
    });
    expect(ms).toBeLessThan(80);
  });
}
