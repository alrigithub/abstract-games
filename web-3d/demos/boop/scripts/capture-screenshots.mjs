#!/usr/bin/env node
/**
 * Headless light + dark captures for Boop demo (compare to Astra B&W mockup).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(__dirname, '..');
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

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });

  let vite = null;
  try {
    await fetch(baseUrl);
  } catch {
    vite = spawn('npm', ['run', 'dev'], {
      cwd: demoRoot,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    await waitForServer();
  }

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    for (const theme of ['light', 'dark']) {
      await page.goto(`${baseUrl}?theme=${theme}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="board"][data-ready="true"]', { timeout: 15_000 });
      await page.waitForTimeout(600);
      const out = path.join(artifactsDir, `boop-${theme}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`Wrote ${out}`);
    }

    await browser.close();
  } finally {
    vite?.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
