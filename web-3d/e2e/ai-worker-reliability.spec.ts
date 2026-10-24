import { expect, test } from '@playwright/test';
import { aiWatchdogMs } from '../engine/src/ai-worker-client';
import { DEFAULT_AI_STRENGTH_LEVELS } from '../engine/src/ui/ai-strength';

/** One smoke per game @ Medium — worker + watchdog, no full strength matrix. */
const medium = DEFAULT_AI_STRENGTH_LEVELS.find(l => l.id === 'medium')!;
const maxThinkMs = aiWatchdogMs(medium.timeBudgetMs) + 800;

type GameSpec = {
  name: string;
  baseURL: string;
  path: string;
  setup?: (page: import('@playwright/test').Page) => Promise<void>;
  playHuman: (page: import('@playwright/test').Page) => Promise<void>;
  waitSettled: (page: import('@playwright/test').Page) => Promise<void>;
};

const games: GameSpec[] = [
  {
    name: 'gomoku',
    baseURL: 'http://127.0.0.1:5192',
    path: '/',
    playHuman: async page => {
      const box = await page.locator('[data-testid="board"]').boundingBox();
      expect(box).toBeTruthy();
      await page.mouse.click(box!.x + box!.width * 0.45, box!.y + box!.height * 0.45);
    },
    waitSettled: async page => {
      await expect(page.locator('[data-testid="game-status"]')).not.toContainText(/thinking/i, { timeout: 60_000 });
    },
  },
  {
    name: 'tak',
    baseURL: 'http://127.0.0.1:5290',
    path: '/?human=ivory',
    setup: async page => {
      await page.waitForSelector('[data-testid="mode-ai"]', { timeout: 30_000 });
      await page.click('[data-testid="mode-ai"]');
      await expect(page.locator('[data-testid="game-status"]')).toContainText(/Round|AI|White|Black/i, {
        timeout: 15_000,
      });
    },
    playHuman: async page => {
      const box = await page.locator('[data-testid="board"]').boundingBox();
      expect(box).toBeTruthy();
      await page.mouse.click(box!.x + box!.width * 0.35, box!.y + box!.height * 0.35);
      await page.mouse.click(box!.x + box!.width * 0.55, box!.y + box!.height * 0.55);
    },
    waitSettled: async page => {
      await expect(page.locator('[data-testid="game-status"]')).not.toContainText(/thinking/i, { timeout: 90_000 });
    },
  },
  {
    name: 'boop',
    baseURL: 'http://127.0.0.1:5194',
    path: '/',
    setup: async page => {
      await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
        timeout: 120_000,
      });
    },
    playHuman: async page => {
      const box = await page.locator('[data-testid="board"]').boundingBox();
      expect(box).toBeTruthy();
      await page.mouse.click(box!.x + box!.width * 0.42, box!.y + box!.height * 0.42);
    },
    waitSettled: async page => {
      await expect(page.locator('[data-testid="game-status"]')).not.toContainText(/thinking|stuck/i, { timeout: 90_000 });
    },
  },
  {
    name: 'yinsh',
    baseURL: 'http://127.0.0.1:5196',
    path: '/?e2e=1',
    playHuman: async page => {
      await page.evaluate(async () => {
        const api = (window as unknown as {
          __yinshE2e?: { suggestMove?: () => unknown; applyMove?: (m: unknown) => Promise<void> };
        }).__yinshE2e;
        const move = api?.suggestMove?.();
        if (move) await api?.applyMove?.(move);
      });
    },
    waitSettled: async page => {
      await expect(page.locator('[data-testid="game-status"]')).not.toContainText(/thinking/i, { timeout: 90_000 });
    },
  },
  {
    name: 'tzaar',
    baseURL: 'http://127.0.0.1:5199',
    path: '/?e2e=1',
    setup: async page => {
      await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
        timeout: 60_000,
      });
    },
    playHuman: async page => {
      await page.evaluate(async () => {
        const api = (window as unknown as { __tzaarE2e?: { firstLegalMove: () => unknown; applyMove: (m: unknown) => void } })
          .__tzaarE2e;
        const move = api?.firstLegalMove();
        if (move) api?.applyMove(move);
      });
    },
    waitSettled: async page => {
      await page.evaluate(async () => {
        await (window as unknown as { __tzaarE2e?: { waitForSettled: () => Promise<void> } }).__tzaarE2e?.waitForSettled?.();
      });
    },
  },
];

for (const game of games) {
  test(`${game.name} AI worker smoke (medium)`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`${game.baseURL}${game.path}`);
    if (game.setup) await game.setup(page);
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 120_000 });
    await game.playHuman(page);
    await game.waitSettled(page);
    const status = await page.locator('[data-testid="game-status"]').textContent();
    expect(status ?? '').not.toMatch(/stuck|could not move/i);
    const think = Number.parseInt((await page.evaluate(() => document.body.dataset.maxAiThinkMs ?? '0')) || '0', 10);
    if (think > 0) expect(think).toBeLessThanOrEqual(maxThinkMs);
  });
}
