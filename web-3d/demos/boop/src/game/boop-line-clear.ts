import type { BoardAssistState } from '@abstract/three-engine';
import { cellIndex } from '@abstract/three-engine';
import { BOOP_CAT_FOOTPRINT_WORLD } from './boop-placement-footprints';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';
import type { GameView, LineHighlightView } from './types';

/** Same halo sizing as Yinsh row celebration (`runGlowStyle` in yinsh move-hints). */
export const BOOP_RUN_GLOW_STYLE = {
  markerRadius: BOOP_CAT_FOOTPRINT_WORLD / 2,
  haloScale: 2.2,
} as const;

/** Glow hold + removal pacing (~2s total after parallel boop push). */
export const BOOP_LINE_CLEAR = {
  TOTAL_MS: 2000,
  GLOW_HOLD_MS: 700,
} as const;

export function lineClearRemovalMs(): number {
  return BOOP_LINE_CLEAR.TOTAL_MS - BOOP_LINE_CLEAR.GLOW_HOLD_MS;
}

export function lineClearPhaseMs(): readonly [number, number, number] {
  return [BOOP_LINE_CLEAR.GLOW_HOLD_MS, lineClearRemovalMs(), BOOP_LINE_CLEAR.TOTAL_MS] as const;
}

export function lineCellsFromHighlight(highlight: LineHighlightView | null): [number, number][] | null {
  if (!highlight) return null;
  if (highlight.kind === 'graduation' || highlight.kind === 'win') return highlight.line;
  return null;
}

export function bedCellIndices(line: readonly [number, number][]): number[] {
  return line.map(([x, y]) => cellIndex(BOOP_GRID, y, x, BOOP_OUTSIDE)!);
}

export function buildLineClearAssist(markerCells: readonly number[]): BoardAssistState {
  return {
    runGlows: [{ markerCells, strength: 'announce' }],
    runGlowStyle: { ...BOOP_RUN_GLOW_STYLE },
  };
}

/** Keep graduated line pieces visible on the bed while rules state already cleared them. */
export function viewHoldingLineOnBed(
  before: GameView,
  after: GameView,
  line: readonly [number, number][],
): GameView {
  const board = after.board.map(row => row.map(cell => (cell ? { ...cell } : null)));
  for (const [x, y] of line) {
    board[y]![x] = before.board[y]?.[x] ?? null;
  }
  return { ...after, board, effects: { ...after.effects } };
}

export function lineClearNeedsSequence(
  highlight: LineHighlightView | null,
  graduated: [number, number][] | null,
): boolean {
  const line = lineCellsFromHighlight(highlight);
  if (!line?.length) return false;
  if (graduated?.length) return true;
  return highlight?.kind === 'win';
}
