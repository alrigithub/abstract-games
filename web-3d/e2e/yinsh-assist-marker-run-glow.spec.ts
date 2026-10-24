import { expect, test } from '@playwright/test';

test.describe('Yinsh assist marker ghosts and row glow', () => {
  test('marker-placement shot exposes visible ring-centre ghosts', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('http://127.0.0.1:5196/?shot=assist-marker-place&theme=light');
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
    await page.waitForTimeout(900);

    const stats = await page.evaluate(() => {
      const fn = (window as unknown as { __yinshAssistStats?: () => { markerGhostCount: number; markerGhostMinOpacity: number } })
        .__yinshAssistStats;
      if (!fn) throw new Error('__yinshAssistStats missing');
      return fn();
    });

    expect(stats.markerGhostCount).toBeGreaterThanOrEqual(2);
    expect(stats.markerGhostMinOpacity).toBeGreaterThan(0.3);
  });

  test('run-glow shot with hover highlights exactly five markers', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('http://127.0.0.1:5196/?shot=assist-run-glow&theme=light');
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
    await page.waitForTimeout(900);

    const stats = await page.evaluate(() => {
      const fn = (window as unknown as { __yinshAssistStats?: () => { runGlowCellCount: number } }).__yinshAssistStats;
      if (!fn) throw new Error('__yinshAssistStats missing');
      return fn();
    });

    expect(stats.runGlowCellCount).toBe(6);
  });
});
