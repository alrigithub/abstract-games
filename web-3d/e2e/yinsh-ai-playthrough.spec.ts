import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';

const outDir = path.join(process.cwd(), 'e2e', 'screenshots');

test('Human vs AI Yinsh playthrough with mid-game and end screenshots', async ({ page }) => {
  test.setTimeout(600_000);
  fs.mkdirSync(outDir, { recursive: true });

  await page.addInitScript(() => {
    localStorage.setItem('abstract-yinsh-ai-strength', '0');
  });
  await page.goto('http://127.0.0.1:5196/?e2e=1&theme=light');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
  await page.waitForFunction(() => (window as unknown as { __yinshE2e?: unknown }).__yinshE2e, undefined, {
    timeout: 60_000,
  });

  let midCaptured = false;
  let plies = 0;
  const maxPlies = 900;

  while (plies < maxPlies && !midCaptured) {
    const state = await page.evaluate(async () => {
      const e = (window as unknown as {
        __yinshE2e: {
          winner: () => string | undefined;
          humanTurn: () => boolean;
          suggestMove: () => { tag: string } | null;
          applyMove: (m: unknown) => Promise<void>;
          waitForSettled: (ms?: number) => Promise<void>;
          turnMode: () => string;
        };
      }).__yinshE2e;
      const winner = e.winner();
      if (!winner && e.humanTurn()) {
        const move = e.suggestMove();
        if (move) await e.applyMove(move);
      }
      await e.waitForSettled(45_000);
      return { winner: e.winner() ?? null, turnMode: e.turnMode() };
    });

    plies++;
    await page.waitForTimeout(150);

    if (!midCaptured && plies > 40 && /RingMovement|MarkerPlacement/.test(state.turnMode)) {
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(outDir, 'yinsh-ai-midgame.png'), fullPage: false });
      midCaptured = true;
    }

  }

  const final = await page.evaluate(async () => {
    const e = (window as unknown as {
      __yinshE2e: {
        winner: () => string | undefined;
        finishGameEngine: (max?: number) => string | undefined;
        waitForSettled: (ms?: number) => Promise<void>;
      };
    }).__yinshE2e;
    if (!e.winner()) e.finishGameEngine(6000);
    await e.waitForSettled(5000);
    return e.winner() ?? null;
  });

  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'yinsh-ai-endgame.png'), fullPage: false });

  if (!midCaptured) {
    throw new Error('Mid-game screenshot was not captured');
  }
  if (!final) {
    throw new Error(`Game did not finish with a winner within ${maxPlies} plies (got ${final})`);
  }
});
