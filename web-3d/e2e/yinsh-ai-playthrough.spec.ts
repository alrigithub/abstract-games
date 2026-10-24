import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';

const outDir = path.join(process.cwd(), 'e2e', 'screenshots');

test('Human vs AI Yinsh playthrough with mid-game and end screenshots', async ({ page }) => {
  test.setTimeout(900_000);
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
  const maxPlies = 600;
  let lastPoints = 0;

  while (plies < maxPlies) {
    const state = await page.evaluate(async () => {
      const e = (window as unknown as {
        __yinshE2e: {
          winner: () => string | undefined;
          humanTurn: () => boolean;
          suggestMove: () => { tag: string } | null;
          applyMove: (m: unknown) => Promise<void>;
          waitForSettled: (ms?: number) => Promise<void>;
          turnMode: () => string;
          pointsA: () => number;
          pointsB: () => number;
        };
      }).__yinshE2e;
      const winner = e.winner();
      if (!winner && e.humanTurn()) {
        const move = e.suggestMove();
        if (move) await e.applyMove(move);
      }
      if (!e.winner() && e.humanTurn() && !e.suggestMove()) {
        throw new Error('Human turn with no suggested move');
      }
      await e.waitForSettled(45_000);
      return {
        winner: e.winner() ?? null,
        turnMode: e.turnMode(),
        points: e.pointsA() + e.pointsB(),
      };
    });

    plies++;
    await page.waitForTimeout(40);

    if (!midCaptured && plies > 45 && /RingMovement|MarkerPlacement/.test(state.turnMode)) {
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(outDir, 'yinsh-ai-midgame.png'), fullPage: false });
      midCaptured = true;
    }

    if (state.points > lastPoints) {
      lastPoints = state.points;
    }

    if (state.winner) break;
  }

  const final = await page.evaluate(async () => {
    const e = (window as unknown as {
      __yinshE2e: {
        winner: () => string | undefined;
        waitForSettled: (ms?: number) => Promise<void>;
        pointsA: () => number;
        pointsB: () => number;
      };
    }).__yinshE2e;
    await e.waitForSettled(8000);
    return {
      winner: e.winner() ?? null,
      points: e.pointsA() + e.pointsB(),
    };
  });

  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'yinsh-ai-endgame.png'), fullPage: false });

  if (!midCaptured) {
    throw new Error('Mid-game screenshot was not captured');
  }
  if (!final.winner) {
    throw new Error(`Game did not finish with a winner within ${maxPlies} plies`);
  }
  if (final.points < 1) {
    throw new Error('Expected at least one scored row (ring on rack) in a finished game');
  }
});
