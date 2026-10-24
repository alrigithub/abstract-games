import { test } from '@playwright/test';
import path from 'node:path';

const screenshotDir = path.join(process.cwd(), 'e2e', 'screenshots');

const shots = [
  { slug: 'assist-ring-dest', file: 'yinsh-assist-ring-destinations' },
  { slug: 'assist-path-flip', file: 'yinsh-assist-path-flip' },
  { slug: 'assist-run-pick', file: 'yinsh-assist-run-pick' },
  { slug: 'assist-ai-move', file: 'yinsh-assist-ai-last-move' },
] as const;

test.describe('Yinsh move assist screenshots', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const { slug, file } of shots) {
      test(`${slug} (${theme})`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(`http://127.0.0.1:5196/?shot=${slug}&theme=${theme}`);
        await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
        await page.waitForTimeout(900);
        const suffix = theme === 'dark' ? '-dark' : '-light';
        await page.screenshot({
          path: path.join(screenshotDir, `${file}${suffix}.png`),
          fullPage: false,
        });
      });
    }
  }
});
