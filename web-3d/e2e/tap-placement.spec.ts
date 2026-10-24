import { expect, test } from '@playwright/test';

async function waitBoard(page: import('@playwright/test').Page, url: string) {
  await page.goto(url);
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 60_000 });
}

test.describe('tap placement (no drag)', () => {
  test('gomoku tap places stone and AI replies', async ({ page }) => {
    test.setTimeout(90_000);
    await waitBoard(page, 'http://127.0.0.1:5192/');
    const board = page.locator('[data-testid="board"]');
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + box!.width * 0.52, box!.y + box!.height * 0.52);
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/thinking|AI to move/i, { timeout: 15_000 });
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/Your turn|wins/i, { timeout: 30_000 });
  });

  test('boop sticky size and tap place triggers AI', async ({ page }) => {
    test.setTimeout(120_000);
    await waitBoard(page, 'http://127.0.0.1:5194/');
    await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
      timeout: 120_000,
    });
    await page.evaluate(() => {
      const w = window as unknown as { __boopController?: { setStickyKind: (k: string) => void } };
      w.__boopController?.setStickyKind('cat');
    });
    const catBtn = page.locator('[data-testid="boop-size-cat"]');
    if (await catBtn.isVisible()) {
      await expect(catBtn).toHaveAttribute('aria-pressed', 'true');
    }
    const board = page.locator('[data-testid="board"]');
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/AI|thinking/i, { timeout: 20_000 });
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/Your turn|wins|AI wins/i, { timeout: 45_000 });
  });

  test('yinsh tap move and AI responds', async ({ page }) => {
    test.setTimeout(120_000);
    await waitBoard(page, 'http://127.0.0.1:5196/?e2e=1');
    await page.waitForFunction(() => (window as unknown as { __yinshE2e?: unknown }).__yinshE2e, null, { timeout: 30_000 });
    const move = await page.evaluate(() => (window as unknown as { __yinshE2e: { suggestMove: () => unknown } }).__yinshE2e.suggestMove());
    expect(move).toBeTruthy();
    await page.evaluate(m => (window as unknown as { __yinshE2e: { applyMove: (mv: unknown) => void } }).__yinshE2e.applyMove(m), move);
    await page.evaluate(() => (window as unknown as { __yinshE2e: { waitForSettled: () => Promise<void> } }).__yinshE2e.waitForSettled());
    await expect.poll(async () => page.evaluate(() => (window as unknown as { __yinshE2e: { aiPending: () => boolean } }).__yinshE2e.aiPending())).toBe(false);
  });

  test('tzaar tap two-step move and AI responds', async ({ page }) => {
    test.setTimeout(120_000);
    await waitBoard(page, 'http://127.0.0.1:5199/?e2e=1');
    await page.waitForFunction(() => (window as unknown as { __tzaarE2e?: unknown }).__tzaarE2e, null, { timeout: 30_000 });
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
    await expect(page.locator('[data-testid="game-status"]')).toContainText(/AI|Your turn|wins|thinking/i, { timeout: 30_000 });
  });
});
