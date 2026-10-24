#!/usr/bin/env node
/**
 * Low-angle light/dark captures for piece grounding (before/after).
 * BOOP_GROUNDING_PHASE=before|after (default after)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(__dirname, '..');
const phase = process.env.BOOP_GROUNDING_PHASE === 'before' ? 'before' : 'after';
const artifactsDir = process.env.BOOP_ARTIFACTS_DIR ?? '/opt/cursor/artifacts/screenshots';
const port = 5194;
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

async function lowAngleOrbit(page) {
  const canvas = page.locator('[data-testid="board"] canvas');
  const box = await canvas.boundingBox();
  if (!box) return;
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.48;
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(cx - box.width * 0.12, cy + box.height * 0.18, { steps: 18 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(350);
  if (typeof (await page.evaluate(() => window.__boopSetScreenshotCamera)) === 'function') {
    await page.evaluate(() => window.__boopSetScreenshotCamera?.());
    await page.waitForTimeout(200);
  }
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const vite = spawn('npm', ['run', 'dev'], {
    cwd: demoRoot,
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  await waitForServer();

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    for (const theme of ['light', 'dark']) {
      await page.goto(`${baseUrl}?theme=${theme}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="board"][data-ready="true"]', { timeout: 15_000 });
      await page.waitForFunction(() => window.__boopController != null, null, { timeout: 15_000 });
      await page.evaluate(async () => {
        await window.__boopController.ensureRestingOffBoardPiece();
      });
      await page.waitForTimeout(2800);
      await lowAngleOrbit(page);
      await page.waitForTimeout(400);
      const out = path.join(artifactsDir, `boop-${theme}-grounding-${phase}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`Wrote ${out}`);
    }

    await browser.close();
  } finally {
    vite.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
