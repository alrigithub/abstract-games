import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from '@playwright/test';

const outDir = path.join(process.cwd(), 'e2e', 'screenshots');

test('Yinsh ring close-up and Tak piece comparison', async ({ page, browser }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('http://127.0.0.1:5196/?shot=ring-closeup&theme=light');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
  await page.waitForTimeout(1500);
  const board = page.locator('[data-testid="board"]');
  const box = await board.boundingBox();
  if (!box) throw new Error('no board box');
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.52;
  await page.screenshot({
    path: path.join(outDir, 'yinsh-ring-marker-closeup-light.png'),
    clip: { x: Math.max(0, cx - 200), y: Math.max(0, cy - 200), width: 400, height: 400 },
  });

  await page.goto('http://127.0.0.1:5196/?shot=ring-closeup&theme=dark');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
  await page.waitForTimeout(1500);
  const box2 = await board.boundingBox();
  const cx2 = box2!.x + box2!.width * 0.5;
  const cy2 = box2!.y + box2!.height * 0.52;
  await page.screenshot({
    path: path.join(outDir, 'yinsh-ring-marker-closeup-dark.png'),
    clip: { x: Math.max(0, cx2 - 200), y: Math.max(0, cy2 - 200), width: 400, height: 400 },
  });

  const takPage = await browser.newPage();
  await takPage.goto('http://127.0.0.1:5190/?shot=flat-closeup&theme=light');
  await takPage.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
  await takPage.waitForTimeout(2500);
  const takBoard = takPage.locator('[data-testid="board"]');
  const takBox = await takBoard.boundingBox();
  const tx = takBox!.x + takBox!.width * 0.5;
  const ty = takBox!.y + takBox!.height * 0.52;
  await takPage.screenshot({
    path: path.join(outDir, 'tak-piece-closeup-light.png'),
    clip: { x: Math.max(0, tx - 200), y: Math.max(0, ty - 200), width: 400, height: 400 },
  });
  await takPage.close();

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
    path.join(outDir, 'tak-piece-closeup-light.png'),
    path.join(outDir, 'yinsh-ring-marker-closeup-light.png'),
    path.join(outDir, 'tak-yinsh-piece-closeup-comparison.png'),
  ]);
});
