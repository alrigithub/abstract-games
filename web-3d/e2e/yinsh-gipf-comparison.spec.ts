import { test } from '@playwright/test';
import path from 'node:path';
import { openGameMenu } from './game-menu';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const outDir = path.join(process.cwd(), 'e2e', 'screenshots');
const tzaarShotDir = path.join(process.cwd(), 'demos', 'tzaar', 'screenshots');

test.describe.configure({ mode: 'serial' });

async function waitBoard(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
  await page.waitForTimeout(800);
}

test('capture Yinsh light/dark and GIPF comparison strip', async ({ page, browser }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('http://127.0.0.1:5196/');
  await waitBoard(page);
  await page.screenshot({ path: path.join(outDir, 'yinsh-light-initial.png'), fullPage: false });

  await openGameMenu(page);
  await page.click('[data-testid="theme-toggle"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'yinsh-dark-initial.png'), fullPage: false });

  await openGameMenu(page);
  await page.click('[data-testid="theme-toggle"]');
  await page.waitForTimeout(200);
  await openGameMenu(page);
  await page.click('[data-testid="flip-demo"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, 'yinsh-light-flip.png'), fullPage: false });

  await openGameMenu(page);
  await page.click('[data-testid="theme-toggle"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'yinsh-dark-flip.png'), fullPage: false });

  const tzaarPage = await browser.newPage();
  await tzaarPage.goto('http://127.0.0.1:5198/?theme=light');
  await waitBoard(tzaarPage);
  await tzaarPage.screenshot({ path: path.join(tzaarShotDir, 'tzaar-light.png'), fullPage: false });

  await tzaarPage.goto('http://127.0.0.1:5198/?theme=dark');
  await waitBoard(tzaarPage);
  await tzaarPage.screenshot({ path: path.join(tzaarShotDir, 'tzaar-dark.png'), fullPage: false });
  await tzaarPage.close();

  const comparison = path.join(outDir, 'yinsh-tzaar-gipf-comparison.png');
  const python = `
from PIL import Image
import sys
paths = sys.argv[1:-1]
out_path = sys.argv[-1]
imgs = [Image.open(p).convert('RGB') for p in paths]
w = max(i.width for i in imgs)
h = max(i.height for i in imgs)
def pad(im):
    c = Image.new('RGB', (w, h), (240, 238, 232))
    c.paste(im, ((w - im.width)//2, (h - im.height)//2))
    return c
yinsh_l, tzaar_l, yinsh_d, tzaar_d = [pad(i) for i in imgs]
row1 = Image.new('RGB', (w * 2, h))
row1.paste(yinsh_l, (0, 0))
row1.paste(tzaar_l, (w, 0))
row2 = Image.new('RGB', (w * 2, h))
row2.paste(yinsh_d, (0, 0))
row2.paste(tzaar_d, (w, 0))
out = Image.new('RGB', (w * 2, h * 2 + 48), (255, 255, 255))
out.paste(row1, (0, 0))
out.paste(row2, (0, h + 48))
out.save(out_path)
`;
  execFileSync('python3', [
    '-c',
    python,
    path.join(outDir, 'yinsh-light-initial.png'),
    path.join(tzaarShotDir, 'tzaar-light.png'),
    path.join(outDir, 'yinsh-dark-initial.png'),
    path.join(tzaarShotDir, 'tzaar-dark.png'),
    comparison,
  ]);
});
