/**
 * Headless pixel check: vase-base halo vs white arena + thumb/placement UI.
 * Usage: node scripts/verify-contact-shadow.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173/';

function lum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function sampleDisk(png, cx, cy, rInner, rOuter) {
  const ring = [];
  for (let y = Math.max(0, cy - rOuter); y <= Math.min(png.height - 1, cy + rOuter); y++) {
    for (let x = Math.max(0, cx - rOuter); x <= Math.min(png.width - 1, cx + rOuter); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > rOuter || d < rInner) continue;
      const idx = (png.width * y + x) << 2;
      ring.push(lum(png.data[idx], png.data[idx + 1], png.data[idx + 2]));
    }
  }
  const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN);
  return { ringAvg: avg(ring), n: ring.length };
}

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction(() => document.querySelector('#board')?.dataset.ready === 'true', null, {
    timeout: 120_000,
  });
  await page.evaluate(() => window.__boopStageShowcase?.());
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__boopPreviewGhost?.('kitten', 2, 2));

  const shotPath = path.join('/tmp', 'boop-verify.png');
  await page.screenshot({ path: shotPath, fullPage: false });

  const ui = await page.evaluate(() => {
    const thumb = document.querySelector('[data-testid="boop-thumb-control"]');
    const ghost = document.querySelector('[data-testid="boop-placement-ghost"]');
    const kitten = document.querySelector('[data-testid="boop-size-kitten"]');
    const cat = document.querySelector('[data-testid="boop-size-cat"]');
    const rect = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, hidden: el.hidden, display: getComputedStyle(el).display };
    };
    const bg = el => (el ? getComputedStyle(el).backgroundColor : null);
    return {
      thumb: rect(thumb),
      ghost: rect(ghost),
      kitten: rect(kitten),
      cat: rect(cat),
      ghostBorder: ghost ? getComputedStyle(ghost).borderColor : null,
      kittenBg: bg(kitten),
      catBg: bg(cat),
      kittenSelected: kitten?.dataset.selected,
      contactShadowCount: document.querySelectorAll('.boop-dom-contact-shadow').length,
    };
  });

  const cells = await page.evaluate(() => {
    const scene = window.__boopScene;
    const snap = window.__boopController.getSnapshot();
    const boardTop = scene.getBoardTopY();
    const occupied = [];
    for (let cell = 0; cell < snap.playableCells; cell++) {
      const stack = snap.cells[cell] ?? [];
      if (!stack.length) continue;
      const world = scene.getPieceWorldPosition(stack[0].id);
      if (!world) continue;
      const foot = scene.projectToScreen({ x: world.x, y: boardTop + 0.002, z: world.z });
      occupied.push({ cell, x: foot.x, y: foot.y, shape: stack[0].shape });
    }
    const empty = [];
    for (let cell = 0; cell < snap.playableCells && empty.length < 2; cell++) {
      if ((snap.cells[cell] ?? []).length) continue;
      const p = scene.cellScreen(cell);
      empty.push({ cell, x: p.x, y: p.y });
    }
    return { occupied, empty };
  });

  const png = readPng(shotPath);
  const emptyFloor = cells.empty.map(({ cell, x, y }) => {
    const s = sampleDisk(png, Math.round(x), Math.round(y + 12), 10, 18);
    return { cell, floorLum: s.ringAvg };
  });
  const refFloor = emptyFloor.reduce((a, b) => a + b.floorLum, 0) / emptyFloor.length;

  const vaseHalos = cells.occupied.map(({ cell, x, y, shape }) => {
    const s = sampleDisk(png, Math.round(x), Math.round(y), 6, 14);
    const haloAvg = s.ringAvg;
    return { cell, shape, haloAvg, refFloor, delta: refFloor - haloAvg, samples: s.n };
  });

  const bedHalos = vaseHalos.filter(v => v.cell < 36);
  const report = {
    baseUrl,
    ui,
    refFloorLum: refFloor,
    emptyFloor,
    vaseHalos: bedHalos,
    pass:
      bedHalos.length >= 4 &&
      bedHalos.every(v => v.delta >= 12 && v.haloAvg < refFloor - 10) &&
      bedHalos.every(v => v.haloAvg < 235),
    uiPass:
      ui.thumb &&
      ui.kitten &&
      ui.cat &&
      ui.kitten.w >= 34 &&
      ui.cat.w >= 60 &&
      ui.cat.w - ui.kitten.w >= 22 &&
      ui.      ui.kittenBg !== 'rgba(0, 0, 0, 0)' &&
      ui.ghost &&
      !ui.ghost.hidden &&
      ui.ghostBorder?.includes('148, 136') &&
      (ui.contactShadowCount ?? 0) === 0,
  };

  console.log(JSON.stringify(report, null, 2));
  fs.unlinkSync(shotPath);
  await browser.close();
  process.exit(report.pass && report.uiPass ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
