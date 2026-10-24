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

    for (let i = 0; i < 4; i++) {
      await page.evaluate(async idx => {
        await window.__boopController.smokePlace(2 + (idx % 2), 2 + Math.floor(idx / 2));
      }, i);
      await page.waitForTimeout(1200);
    }

    const status = await page.locator('[data-testid="game-status"]').textContent();
    if (!status) throw new Error('missing status line');
    if (errors.length) throw new Error(`console errors: ${errors.join('; ')}`);
    console.log('Smoke OK:', status.trim());
  } finally {
    await browser.close();
    vite.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
