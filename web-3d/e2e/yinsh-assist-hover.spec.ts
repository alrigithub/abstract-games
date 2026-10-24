import { expect, test } from '@playwright/test';

type YinshAssistE2e = {
  turnMode: () => string;
  suggestMove: () => { tag: string; coord?: { x: number; y: number }; start?: { x: number; y: number }; end?: { x: number; y: number } } | null;
  coordToIndex: (coord: { x: number; y: number }) => number;
  simulateHoverAtCell: (index: number) => void;
  setHoverCell: (index: number | null) => void;
  getBoardAssistStats: () => { visibleMeshCount: number; pathSegmentCount: number };
  ringPieceId: (player: string, coord: { x: number; y: number }) => string;
  getPieceWorldPosition: (id: string) => { x: number; y: number; z: number } | null;
  clickSuggestMove: () => Promise<string | null>;
  waitForSettled: (ms?: number) => Promise<void>;
};

async function boot(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('abstract-yinsh-ai-strength', '0');
  });
  await page.goto('http://127.0.0.1:5196/?e2e=1&theme=light');
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 90_000 });
  await page.waitForFunction(() => (window as unknown as { __yinshE2e?: unknown }).__yinshE2e, undefined, {
    timeout: 60_000,
  });
}

test('Yinsh assist shadows/ghosts per phase — no piece lift, assist clears after hover', async ({ page }) => {
  test.setTimeout(600_000);
  await boot(page);

  const seen: Record<string, boolean> = {
    RingPlacement: false,
    MarkerPlacement: false,
    RingMovement: false,
  };

  for (let step = 0; step < 120; step++) {
    const result = await page.evaluate(async () => {
      const e = (window as unknown as { __yinshE2e: YinshAssistE2e }).__yinshE2e;
      const mode = e.turnMode();
      const move = e.suggestMove();
      if (!move || move.tag === 'Wait') {
        await e.clickSuggestMove();
        await e.waitForSettled(30_000);
        return { mode, skipped: true as const };
      }

      let hoverIndex: number | null = null;
      if (move.tag === 'PlaceRing' || move.tag === 'PlaceMarker') {
        hoverIndex = e.coordToIndex(move.coord!);
      } else if (move.tag === 'MoveRing') {
        hoverIndex = e.coordToIndex(move.end!);
      }

      if (hoverIndex === null) {
        await e.clickSuggestMove();
        await e.waitForSettled(30_000);
        return { mode, skipped: true as const };
      }

      e.simulateHoverAtCell(hoverIndex);
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      const hoverStats = e.getBoardAssistStats();

      let liftDelta = 0;
      if (mode === 'MarkerPlacement' && move.tag === 'PlaceMarker') {
        const ringId = e.ringPieceId('A', move.coord!);
        const before = e.getPieceWorldPosition(ringId);
        e.simulateHoverAtCell(hoverIndex);
        await new Promise<void>(r => requestAnimationFrame(() => r()));
        const after = e.getPieceWorldPosition(ringId);
        if (before && after) liftDelta = Math.abs(after.y - before.y);
      }

      if (mode === 'RingMovement' && move.tag === 'MoveRing') {
        const ringId = e.ringPieceId('A', move.start!);
        const before = e.getPieceWorldPosition(ringId);
        e.simulateHoverAtCell(hoverIndex);
        await new Promise<void>(r => requestAnimationFrame(() => r()));
        const after = e.getPieceWorldPosition(ringId);
        if (before && after) liftDelta = Math.abs(after.y - before.y);
      }

      e.setHoverCell(null);
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      const cleared = e.getBoardAssistStats();

      return {
        mode,
        hoverStats,
        cleared,
        liftDelta,
        skipped: false as const,
      };
    });

    if (result.skipped) continue;

    expect(result.hoverStats!.visibleMeshCount).toBeGreaterThan(0);
    expect(result.hoverStats!.pathSegmentCount).toBe(0);
    expect(result.liftDelta!).toBeLessThan(0.001);
    expect(result.cleared!.pathSegmentCount).toBe(0);

    if (result.mode === 'RingPlacement') seen.RingPlacement = true;
    if (result.mode === 'MarkerPlacement') seen.MarkerPlacement = true;
    if (result.mode === 'RingMovement' && result.hoverStats!.visibleMeshCount > 2) seen.RingMovement = true;

    if (seen.RingPlacement && seen.MarkerPlacement && seen.RingMovement) break;

    await page.evaluate(async () => {
      const e = (window as unknown as { __yinshE2e: YinshAssistE2e }).__yinshE2e;
      await e.clickSuggestMove();
      await e.waitForSettled(45_000);
    });
  }

  expect(seen.RingPlacement).toBe(true);
  expect(seen.MarkerPlacement).toBe(true);
  expect(seen.RingMovement).toBe(true);
});
