import { describe, expect, it } from 'vitest';
import { countSelected, moveStackSuffix, stackHeight, topSuffix } from './stack';
import type { BoardSnapshot, EnginePiece } from './types';

const piece = (id: string): EnginePiece => ({ id, player: 'A', shape: 'flat' });

describe('stack helpers', () => {
  it('countSelected respects hold interval', () => {
    expect(countSelected(0, 5, 400)).toBe(1);
    expect(countSelected(399, 5, 400)).toBe(1);
    expect(countSelected(400, 5, 400)).toBe(2);
    expect(countSelected(2000, 5, 400)).toBe(5);
  });

  it('moveStackSuffix moves top suffix preserving order', () => {
    const snap: BoardSnapshot = {
      playableCells: 4,
      cellCount: 4,
      cells: [[piece('a'), piece('b'), piece('c')], [], [], []],
    };
    const next = moveStackSuffix(snap, { source: 0, count: 2 }, 1);
    expect(next.cells[0]!.map(p => p.id)).toEqual(['a']);
    expect(next.cells[1]!.map(p => p.id)).toEqual(['b', 'c']);
  });

  it('topSuffix and stackHeight', () => {
    const stack = [piece('1'), piece('2'), piece('3')];
    expect(topSuffix({ playableCells: 1, cellCount: 1, cells: [stack] }, 0, 2).map(p => p.id)).toEqual(['2', '3']);
    expect(stackHeight(stack, () => 0.18)).toBeCloseTo(0.54);
  });
});
