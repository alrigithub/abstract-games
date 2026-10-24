import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from '@playwright/test';

const outDir = path.join(process.cwd(), 'e2e', 'screenshots');

/** GIPF close-up: Tzaar disc vs Yinsh ring + marker, matched camera. */
test('Yinsh ring close-up and Tzaar GIPF disc comparison', async ({ page, browser }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('http://127.0.0.1:5196/?shot=ring-closeup&theme=light');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
  await page.waitForTimeout(2500);
  const board = page.locator('[data-testid="board"]');
  const box = await board.boundingBox();
  if (!box) throw new Error('no board box');
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.52;
  await page.screenshot({
    path: path.join(outDir, 'yinsh-ring-marker-closeup-light.png'),
    clip: { x: Math.max(0, cx - 220), y: Math.max(0, cy - 220), width: 440, height: 440 },
  });

  const tzaarPage = await browser.newPage();
  await tzaarPage.goto('http://127.0.0.1:5198/?shot=disc-closeup&theme=light');
  await tzaarPage.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
  await tzaarPage.waitForTimeout(2500);
  const tzaarBoard = tzaarPage.locator('[data-testid="board"]');
  const tzaarBox = await tzaarBoard.boundingBox();
  const tx = tzaarBox!.x + tzaarBox!.width * 0.5;
  const ty = tzaarBox!.y + tzaarBox!.height * 0.52;
  await tzaarPage.screenshot({
    path: path.join(outDir, 'tzaar-disc-closeup-light.png'),
    clip: { x: Math.max(0, tx - 220), y: Math.max(0, ty - 220), width: 440, height: 440 },
  });
  await tzaarPage.close();

  const python = `
from PIL import Image
import sys
a, b, out = sys.argv[1:4]
ia = Image.open(a).convert('RGB')
ib = Image.open(b).convert('RGB')
w = max(ia.width, ib.width)
h = max(ia.height, ib.height)
def pad(im):
    c = Image.new('RGB', (w, h), (240, 238, 232))
    c.paste(im, ((w-im.width)//2, (h-im.height)//2))
    return c
row = Image.new('RGB', (w*2, h))
row.paste(pad(ia), (0,0))
row.paste(pad(ib), (w,0))
row.save(out)
`;
  execFileSync('python3', [
    '-c',
    python,
    path.join(outDir, 'tzaar-disc-closeup-light.png'),
    path.join(outDir, 'yinsh-ring-marker-closeup-light.png'),
    path.join(outDir, 'tzaar-yinsh-gipf-closeup-comparison.png'),
  ]);
});
