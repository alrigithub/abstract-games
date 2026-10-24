import { expect, test } from '@playwright/test';
import path from 'node:path';

const screenshotDir = path.join(process.cwd(), 'e2e', 'screenshots');

const shots = [
  { slug: 'assist-ring-place', file: 'yinsh-assist-ring-placement-hover' },
  { slug: 'assist-marker-place', file: 'yinsh-assist-marker-placement-ghosts' },
  { slug: 'assist-path-flip', file: 'yinsh-assist-ring-move-ghost-shadow' },
  { slug: 'assist-ai-move', file: 'yinsh-assist-ai-last-move-ghost' },
  { slug: 'assist-run-glow', file: 'yinsh-assist-run-glow' },
  { slug: 'assist-ring-removal', file: 'yinsh-assist-ring-removal-prompt' },
] as const;

test.describe('Yinsh move assist screenshots', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const { slug, file } of shots) {
      test(`${slug} (${theme})`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(`http://127.0.0.1:5196/?shot=${slug}&theme=${theme}`);
        await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
        await page.waitForTimeout(slug === 'assist-run-glow' ? 1200 : 900);
        const stats = await page.evaluate(() => {
          const fn = (window as unknown as { __yinshAssistStats?: () => Record<string, number> }).__yinshAssistStats;
          return fn?.() ?? {};
        });
        if (slug === 'assist-marker-place') {
          expect(stats.markerGhostCount ?? 0).toBeGreaterThanOrEqual(2);
          expect(stats.markerGhostMinOpacity ?? 0).toBeGreaterThan(0.3);
        }
        if (slug === 'assist-run-glow') {
          expect(stats.runGlowCellCount ?? 0).toBe(6);
        }
        const suffix = theme === 'dark' ? '-dark' : '-light';
        await page.screenshot({
          path: path.join(screenshotDir, `${file}${suffix}.png`),
          fullPage: false,
        });
      });
    }
  }
});
