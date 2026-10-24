import { expect, test } from '@playwright/test';

/** After: same rAF cadence as baseline bench for apples-to-apples frame time. */
const games = [
  {
    name: 'tak',
    url: 'http://127.0.0.1:5190/?human=ivory',
    setup: async (page: import('@playwright/test').Page) => {
      const menu = page.locator('[data-testid="main-menu"]');
      if (await menu.isVisible()) await page.click('[data-testid="mode-sandbox"]');
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

async function renderOnlyMs(page: import('@playwright/test').Page): Promise<number | null> {
  return page.evaluate(() => {
    const bench = (window as unknown as { __benchOneFrame?: () => number }).__benchOneFrame;
    if (!bench) return null;
    let total = 0;
    for (let i = 0; i < 24; i++) total += bench();
    return total / 24;
  });
}

for (const game of games) {
  test(`${game.name} single-frame render time (after)`, async ({ page }) => {
    const url = `${game.url}${game.url.includes('?') ? '&' : '?'}bench=1`;
    await page.goto(url);
    if (game.setup) await game.setup(page);
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 120_000 });
    if (game.ready) {
      await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
        timeout: 120_000,
      });
    }
    await page.waitForTimeout(400);
    const rafMs = await avgFrameMs(page);
    const renderMs = await renderOnlyMs(page);
    expect(Number.isFinite(rafMs)).toBe(true);
    const payload = {
      game: game.name,
      avgFrameMs: rafMs,
      method: 'rAF',
      renderOnlyMs: renderMs,
    };
    await test.info().attach(`${game.name}-frame-ms`, {
      body: Buffer.from(JSON.stringify(payload, null, 2)),
      contentType: 'application/json',
    });
    console.log(
      `[bench-after] ${game.name} rAF=${rafMs.toFixed(2)}ms` +
        (renderMs != null ? ` render-only=${renderMs.toFixed(2)}ms` : ''),
    );
    expect(rafMs).toBeLessThan(80);
  });
}
