import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const outDir = path.join(process.cwd(), 'e2e', 'screenshots');

type PlaceMarkerMove = { tag: 'PlaceMarker'; coord: { x: number; y: number } };
type MoveRingMove = {
  tag: 'MoveRing';
  start: { x: number; y: number };
  end: { x: number; y: number };
};

type YinshE2e = {
  winner: () => string | undefined;
  humanTurn: () => boolean;
  turnMode: () => string;
  suggestMove: () => PlaceMarkerMove | MoveRingMove | { tag: string } | null;
  clickSuggestMove: () => Promise<string | null>;
  waitForSettled: (ms?: number) => Promise<void>;
  ringPieceId: (player: string, coord: { x: number; y: number }) => string;
  coordToIndex: (coord: { x: number; y: number }) => number;
  getPieceWorldPosition: (id: string) => { x: number; y: number; z: number } | null;
  simulateHoverAtCell: (index: number) => void;
  getStackBottomBaseYs: () => number[];
};

test('Yinsh human clicks vs AI — marker hover, fill, ring jump, no console errors', async ({ page }) => {
  test.setTimeout(600_000);
  fs.mkdirSync(outDir, { recursive: true });

  const consoleErrors: string[] = [];
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.addInitScript(() => {
    localStorage.setItem('abstract-yinsh-ai-strength', '0');
  });
  await page.goto('http://127.0.0.1:5196/?e2e=1&theme=light');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
  await page.waitForFunction(() => (window as unknown as { __yinshE2e?: unknown }).__yinshE2e, undefined, {
    timeout: 60_000,
  });

  let humanPlies = 0;
  let sawMarkerPlacement = false;
  let sawRingMove = false;
  let sawJumpRingMove = false;
  let hoverLiftChecked = false;
  const maxHumanPlies = 100;

  while (humanPlies < maxHumanPlies) {
    const step = await page.evaluate(async () => {
      const e = (window as unknown as { __yinshE2e: YinshE2e }).__yinshE2e;
      if (e.winner()) return { kind: 'won' as const };
      if (!e.humanTurn()) {
        await e.waitForSettled(45_000);
        return { kind: 'wait-ai' as const };
      }

      const suggested = e.suggestMove();
      let hoverLiftDelta: number | null = null;
      if (
        suggested?.tag === 'PlaceMarker' &&
        e.turnMode() === 'MarkerPlacement' &&
        !(window as unknown as { __yinshHoverDone?: boolean }).__yinshHoverDone
      ) {
        (window as unknown as { __yinshHoverDone?: boolean }).__yinshHoverDone = true;
        const coord = (suggested as PlaceMarkerMove).coord;
        const ringId = e.ringPieceId('A', coord);
        const idx = e.coordToIndex(coord);
        const before = e.getPieceWorldPosition(ringId);
        e.simulateHoverAtCell(idx);
        await new Promise<void>(r => requestAnimationFrame(() => r()));
        await new Promise<void>(r => requestAnimationFrame(() => r()));
        const after = e.getPieceWorldPosition(ringId);
        if (before && after) hoverLiftDelta = after.y - before.y;
      }

      let jump = false;
      if (suggested?.tag === 'MoveRing') {
        const m = suggested as MoveRingMove;
        jump = Math.max(Math.abs(m.end.x - m.start.x), Math.abs(m.end.y - m.start.y)) > 1;
      }

      const tag = await e.clickSuggestMove();
      return { kind: 'human' as const, tag, jump, hoverLiftDelta };
    });

    if (step.kind === 'won') break;
    if (step.kind === 'wait-ai') continue;

    humanPlies++;
    if (step.tag === 'PlaceMarker') sawMarkerPlacement = true;
    if (step.tag === 'MoveRing') sawRingMove = true;
    if (step.jump) sawJumpRingMove = true;
    if (step.hoverLiftDelta !== null && step.hoverLiftDelta !== undefined) {
      expect(Math.abs(step.hoverLiftDelta)).toBeLessThan(0.002);
      hoverLiftChecked = true;
    }

    if (humanPlies === 12) {
      await page.screenshot({ path: path.join(outDir, 'yinsh-human-clicks-mid.png'), fullPage: false });
    }
    await page.waitForTimeout(40);
  }

  await page.evaluate(async () => {
    const e = (window as unknown as { __yinshE2e: YinshE2e }).__yinshE2e;
    await e.waitForSettled(12_000);
  });
  await page.screenshot({ path: path.join(outDir, 'yinsh-human-clicks-after-moves.png'), fullPage: false });

  const stackYs = await page.evaluate(() => {
    const e = (window as unknown as { __yinshE2e: YinshE2e }).__yinshE2e;
    return e.getStackBottomBaseYs();
  });
  expect(stackYs.length).toBeGreaterThan(0);
  for (const y of stackYs) {
    expect(y).toBeGreaterThan(-0.05);
    expect(y).toBeLessThan(0.25);
  }

  expect(hoverLiftChecked, 'marker-placement hover lift check did not run').toBe(true);
  expect(sawMarkerPlacement).toBe(true);
  expect(sawRingMove).toBe(true);
  expect(sawJumpRingMove).toBe(true);
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
});
