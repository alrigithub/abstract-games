#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 5194;
const baseUrl = `http://127.0.0.1:${port}/`;

function waitForServer(ms = 90_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(baseUrl);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > ms) reject(new Error('dev server timeout'));
      else setTimeout(tick, 400);
    };
    tick();
  });
}

async function main() {
  const vite = spawn('npm', ['run', 'dev'], {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: 'pipe',
  });
  await waitForServer();

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="board"][data-ready="true"]', { timeout: 30_000 });
    await page.waitForFunction(() => window.__boopController != null, null, { timeout: 15_000 });
    await page.waitForFunction(() => window.__boopSmokePickAndPlace != null, null, { timeout: 5_000 });

    await page.evaluate(async () => {
      await window.__boopSmokePickAndPlace();
    });
    await page.waitForTimeout(2200);
    const pickAfterPlace = await page.getAttribute('[data-testid="board"]', 'data-pick-active');
    if (pickAfterPlace === 'true') throw new Error('pick still active after drag placement');

    for (let i = 1; i < 4; i++) {
      await page.evaluate(async idx => {
        await window.__boopController.smokePlace(2 + (idx % 2), 2 + Math.floor(idx / 2));
      }, i);
      await page.waitForTimeout(2200);
    }

    const rested = await page.evaluate(async () => window.__boopController.ensureRestingOffBoardPiece());
    if (!rested) throw new Error('could not produce resting off-board piece');
    const restingCount = await page.getAttribute('[data-testid="board"]', 'data-resting-count');
    if (!restingCount || Number(restingCount) < 1) {
      throw new Error(`expected data-resting-count >= 1, got ${restingCount}`);
    }

    await page.waitForFunction(() => window.__boopAssertGrounding != null, null, { timeout: 5_000 });
    const grounding = await page.evaluate(() => window.__boopAssertGrounding());
    if (!grounding?.ok) {
      throw new Error(
        `piece bases not on board top (max gap ${grounding?.maxGap}, boardTop ${grounding?.boardTop}, n=${grounding?.bases?.length})`,
      );
    }

    const status = await page.locator('[data-testid="game-status"]').textContent();
    if (!status) throw new Error('missing status line');
    if (errors.length) throw new Error(`console errors: ${errors.join('; ')}`);
    console.log('Smoke OK:', status.trim(), `(grounding max gap ${grounding.maxGap.toFixed(4)})`);
  } finally {
    await browser.close();
    vite.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
