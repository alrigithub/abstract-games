import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const artifactsDir =
  process.env.BOOP_ARTIFACTS_DIR ?? path.join(process.cwd(), '../artifacts/screenshots');

test.describe('Boop graduation + Big + AI', () => {
  test('human first graduation, Big toggle, AI responds with consistent counts', async ({ page }) => {
    fs.mkdirSync(artifactsDir, { recursive: true });

    await page.goto('/?theme=light', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="board"][data-ready="true"]', { timeout: 30_000 });
    await page.waitForFunction(() => window.__boopPlayToHumanFirstGraduation != null, null, {
      timeout: 15_000,
    });
    await page.evaluate(() => window.__boopSetCameraPreset?.('axo'));

    const staged = await page.evaluate(async () => window.__boopPlayToHumanFirstGraduation!());
    expect(staged).toBe(true);

    await page.locator('[data-testid="boop-size-cat"]').click();
    await expect(page.locator('[data-testid="boop-size-cat"]')).toHaveAttribute('aria-pressed', 'true');

    const poolsBeforeAi = await page.evaluate(() => window.__boopController!.humanPoolView());
    expect(poolsBeforeAi?.cats_in_hand).toBe(3);
    expect(poolsBeforeAi?.cats_in_reserve).toBe(5);
    expect(poolsBeforeAi?.kittens_in_hand).toBe(5);

    await page.waitForFunction(
      () => {
        const text = document.querySelector('[data-testid="game-status"]')?.textContent ?? '';
        return !text.includes('AI thinking');
      },
      null,
      { timeout: 45_000 },
    );

    await page.waitForFunction(() => window.__boopController!.canInteract(), null, { timeout: 45_000 });

    const after = await page.evaluate(() => ({
      pools: window.__boopController!.humanPoolView(),
      bOnBed: window.__boopController!.countOnBed('B'),
      status: document.querySelector('[data-testid="game-status"]')?.textContent ?? '',
      grounding: window.__boopAssertGrounding!(),
    }));

    expect(after.bOnBed).toBeGreaterThan(0);
    expect(after.status).not.toContain('AI thinking');
    expect(after.grounding.ok).toBe(true);
    expect(after.pools?.kittens_in_hand).toBe(5);

    await page.screenshot({
      path: path.join(artifactsDir, 'boop-after-first-graduation.png'),
      fullPage: false,
    });
  });
});

declare global {
  interface Window {
    __boopPlayToHumanFirstGraduation?: () => Promise<boolean>;
    __boopController?: import('../demos/boop/src/game/controller').BoopController;
    __boopAssertGrounding?: () => { ok: boolean; maxGap: number };
    __boopSetCameraPreset?: (preset: 'top' | 'axo') => void;
  }
}
