#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const artifactsDir = process.env.BOOP_ARTIFACTS_DIR ?? '/opt/cursor/artifacts/screenshots';
const baseUrl = 'http://127.0.0.1:5194/?theme=light';

async function waitForServer(ms = 60_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error('server not ready');
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  await waitForServer();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="board"][data-ready="true"]', { timeout: 60_000 });
  await page.evaluate(() => window.__boopStageShowcase?.());
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__boopSetCameraPreset?.('axo'));
  await page.waitForTimeout(800);

  const thumb = page.locator('[data-testid="boop-thumb-control"]');
  await page.evaluate(() => window.__boopController?.setStickyKind('cat'));
  await page.waitForTimeout(200);
  await thumb.screenshot({ path: path.join(artifactsDir, 'boop-control-big-vase.png') });

  await page.evaluate(() => window.__boopController?.setStickyKind('kitten'));
  await page.waitForTimeout(200);
  await thumb.screenshot({ path: path.join(artifactsDir, 'boop-control-small-vase.png') });

  await page.evaluate(() => {
    window.__boopPreviewGhost?.('cat', 2, 2);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactsDir, 'boop-marker-big-vase.png') });

  await page.evaluate(() => {
    window.__boopPreviewGhost?.('kitten', 2, 2);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactsDir, 'boop-marker-small-vase.png') });

  await browser.close();
  console.log('Wrote ring UI screenshots to', artifactsDir);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
