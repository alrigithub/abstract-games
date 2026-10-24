/** Rules-agnostic stack suffix helpers (mirrors `state.ts` moveSelection). */

export type CellStacks = ReadonlyArray<ReadonlyArray<string>>;

export function stackHeight(cells: CellStacks, index: number): number {
  return cells[index]?.length ?? 0;
}

/** Top `count` piece ids from `source` (bottom-to-top order preserved). */
export function takeTopSuffix(stack: readonly string[], count: number): string[] {
  const n = Math.max(0, Math.min(stack.length, Math.floor(count)));
  return stack.slice(stack.length - n);
}

export function applyMoveSuffix(
  cells: string[][],
  source: number,
  target: number,
  count: number,
): string[][] {
  if (source === target) return cells;
  const src = cells[source] ?? [];
  const dst = cells[target] ?? [];
  const n = Math.max(0, Math.min(src.length, Math.floor(count)));
  if (!n) return cells;
  const next = cells.map((c) => c.slice());
  next[source] = src.slice(0, src.length - n);
  next[target] = [...dst, ...takeTopSuffix(src, n)];
  return next;
}

/** Hold-to-split: same formula as `countSelected()` in tak `state.ts`. */
export function countSelectedHold(
  elapsedMs: number,
  stackHeight: number,
  intervalMs: number,
): number {
  const duration = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 400;
  return Math.max(0, Math.min(stackHeight, 1 + Math.floor(Math.max(0, elapsedMs) / duration)));
}
