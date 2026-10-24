#!/usr/bin/env node
/** Screenshot: two vases resting off the same edge after sequential boops. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(__dirname, '..');
const artifactsDir = process.env.BOOP_ARTIFACTS_DIR ?? '/opt/cursor/artifacts/screenshots';
const port = 5195;
const baseUrl = `http://127.0.0.1:${port}/`;

function waitForServer(ms = 60_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(baseUrl);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > ms) reject(new Error('Vite dev server did not start'));
      else setTimeout(tick, 400);
    };
    tick();
  });
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const vite = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--strictPort'], {
    cwd: demoRoot,
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  await waitForServer();

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${baseUrl}?theme=light`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="board"][data-ready="true"]', { timeout: 15_000 });
    await page.waitForFunction(() => window.__boopController != null, null, { timeout: 15_000 });
    await page.evaluate(() => window.__boopSetCameraPreset?.('axo'));
    await page.waitForTimeout(400);

    const ok = await page.evaluate(async () => window.__boopController.ensureTwoRestingSameEdgeCell());
    if (!ok) throw new Error('could not stage two resting off-board pieces');

    await page.waitForTimeout(600);
    const out = path.join(artifactsDir, 'boop-two-resting-same-edge.png');
    await page.screenshot({ path: out, fullPage: false });
    console.log(`Wrote ${out}`);

    await browser.close();
  } finally {
    vite.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
