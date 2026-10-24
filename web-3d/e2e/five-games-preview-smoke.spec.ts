import { expect, test } from '@playwright/test';

function collectErrors(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function clickBoardFraction(page: import('@playwright/test').Page, fx: number, fy: number) {
  const box = await page.locator('[data-testid="board"]').boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box!.x + box!.width * fx, box!.y + box!.height * fy);
}

const games = [
  {
    name: 'tak',
    baseURL: 'http://127.0.0.1:5290',
    path: '/?human=ivory',
    setup: async (page: import('@playwright/test').Page) => {
      await page.waitForSelector('[data-testid="mode-ai"]', { timeout: 30_000 });
      await page.click('[data-testid="mode-ai"]');
      await expect(page.locator('[data-testid="game-status"]')).toContainText(/Round|AI|White|Black/i, {
        timeout: 15_000,
      });
    },
    play: async (page: import('@playwright/test').Page) => {
      await clickBoardFraction(page, 0.35, 0.35);
      await clickBoardFraction(page, 0.55, 0.55);
    },
    expectAi: async (page: import('@playwright/test').Page) => {
      await expect(page.locator('[data-testid="game-status"]')).toContainText(/AI|thinking|White|Black/i, {
        timeout: 45_000,
      });
    },
  },
  {
    name: 'gomoku',
    baseURL: 'http://127.0.0.1:5292',
    path: '/',
    play: async (page: import('@playwright/test').Page) => {
      await clickBoardFraction(page, 0.5, 0.5);
    },
    expectAi: async (page: import('@playwright/test').Page) => {
      await expect(page.locator('[data-testid="game-status"]')).toContainText(/Your turn|AI/i, { timeout: 45_000 });
    },
  },
  {
    name: 'boop',
    baseURL: 'http://127.0.0.1:5294',
    path: '/',
    ready: async (page: import('@playwright/test').Page) => {
      await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
        timeout: 120_000,
      });
    },
    play: async (page: import('@playwright/test').Page) => {
      await clickBoardFraction(page, 0.52, 0.52);
    },
    expectAi: async (page: import('@playwright/test').Page) => {
      await expect(page.locator('[data-testid="game-status"]')).toContainText(/AI|Your turn/i, { timeout: 60_000 });
    },
  },
  {
    name: 'yinsh',
    baseURL: 'http://127.0.0.1:5296',
    path: '/?e2e=1',
    play: async (page: import('@playwright/test').Page) => {
      await clickBoardFraction(page, 0.5, 0.5);
    },
    expectAi: async (page: import('@playwright/test').Page) => {
      await expect(page.locator('[data-testid="game-status"]')).toContainText(/AI|Your turn|ring/i, { timeout: 60_000 });
    },
  },
  {
    name: 'tzaar',
    baseURL: 'http://127.0.0.1:5299',
    path: '/?e2e=1',
    ready: async (page: import('@playwright/test').Page) => {
      await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
        timeout: 60_000,
      });
    },
    play: async (page: import('@playwright/test').Page) => {
      const move = await page.evaluate(() => window.__tzaarE2e?.firstLegalMove() ?? null);
      expect(move).toBeTruthy();
      await page.evaluate(m => window.__tzaarE2e?.applyMove(m!), move);
    },
    expectAi: async (page: import('@playwright/test').Page) => {
      await expect(page.locator('[data-testid="game-status"]')).toContainText(/AI|Tap|thinking/i, { timeout: 45_000 });
    },
  },
] as const;

for (const game of games) {
  test(`${game.name} preview: loads, human move, AI responds`, async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    await page.goto(`${game.baseURL ?? baseURL}${game.path}`);
    if (game.setup) await game.setup(page);
    await page.waitForSelector('[data-testid="board"] canvas', { timeout: 120_000 });
    if (game.ready) await game.ready(page);
    await page.waitForTimeout(400);
    await game.play(page);
    await page.waitForTimeout(600);
    await game.expectAi(page);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
