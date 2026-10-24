#!/usr/bin/env node
/**
 * Capture a game demo screenshot and fail if the canvas looks blank/unrendered.
 * Usage: node scripts/capture-scene-screenshot.mjs <url> <output.png>
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const url = process.argv[2];
const out = process.argv[3];
if (!url || !out) {
  console.error('Usage: node scripts/capture-scene-screenshot.mjs <url> <output.png>');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
try {
  await page.waitForSelector('[data-testid="board"][data-ready="true"]', { timeout: 25000 });
} catch {
  /* gomoku has no data-ready hook */
}
await page.waitForFunction(
  () => {
    const c = document.querySelector('canvas');
    return c && c.width >= 64 && c.height >= 64;
  },
  { timeout: 30000 },
);
if (url.includes('5194')) {
  try {
    await page.waitForFunction(() => window.__boopStageShowcase != null, null, { timeout: 12000 });
    await page.evaluate(() => window.__boopStageShowcase());
    await page.waitForTimeout(1500);
  } catch {
    /* optional */
  }
}
await page.waitForTimeout(4500);

const stats = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { ok: false, reason: 'no canvas', w: 0, h: 0 };
  return { ok: canvas.width >= 64 && canvas.height >= 64, w: canvas.width, h: canvas.height };
});

const png = await page.screenshot({ path: out, fullPage: false });
await browser.close();

writeFileSync(out, png);
const kb = Math.round(png.length / 1024);
console.log(JSON.stringify({ out, kb, stats }, null, 2));
if (!stats.ok || kb < 20) {
  console.error('Screenshot failed validation (blank or too uniform/small)');
  process.exit(1);
}
