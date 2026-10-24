import { describe, expect, it } from 'vitest';
import {
  bedCellIndices,
  BOOP_LINE_CLEAR,
  buildLineClearAssist,
  lineClearNeedsSequence,
  lineClearPhaseMs,
  lineClearRemovalMs,
  lineCellsFromHighlight,
} from './boop-line-clear';
import { cellIndex } from '@abstract/three-engine';
import { BOOP_GRID, BOOP_OUTSIDE } from './boop-grid';

describe('boop line clear sequence', () => {
  it('targets graduation and win lines for the orange glow', () => {
    expect(lineCellsFromHighlight({ kind: 'graduation', line: [[0, 0], [1, 0], [2, 0]] })).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    expect(lineCellsFromHighlight({ kind: 'win', line: [[3, 3], [4, 3], [5, 3]] })).toHaveLength(3);
    expect(lineCellsFromHighlight({ kind: 'eight_cats_on_bed' })).toBeNull();
  });

  it('uses Yinsh-style run glow assist on bed cell indices', () => {
    const line: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const assist = buildLineClearAssist(bedCellIndices(line));
    expect(assist.runGlows?.[0]?.strength).toBe('announce');
    expect(assist.runGlowStyle?.haloScale).toBe(2.2);
    expect(assist.runGlows?.[0]?.markerCells).toEqual([
      cellIndex(BOOP_GRID, 0, 0, BOOP_OUTSIDE),
      cellIndex(BOOP_GRID, 0, 1, BOOP_OUTSIDE),
      cellIndex(BOOP_GRID, 0, 2, BOOP_OUTSIDE),
    ]);
  });

  it('holds glow then removes over ~2 seconds total', () => {
    const [hold, remove, total] = lineClearPhaseMs();
    expect(hold).toBe(BOOP_LINE_CLEAR.GLOW_HOLD_MS);
    expect(remove).toBe(lineClearRemovalMs());
    expect(total).toBe(2000);
    expect(hold + remove).toBe(total);
  });

  it('runs after boop push when graduating or winning a line', () => {
    expect(
      lineClearNeedsSequence({ kind: 'graduation', line: [[0, 0], [1, 0], [2, 0]] }, [[0, 0], [1, 0], [2, 0]]),
    ).toBe(true);
    expect(lineClearNeedsSequence({ kind: 'win', line: [[0, 0], [1, 0], [2, 0]] }, null)).toBe(true);
    expect(lineClearNeedsSequence(null, [[0, 0]])).toBe(false);
  });
});
