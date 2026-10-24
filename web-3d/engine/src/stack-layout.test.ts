import { describe, expect, it } from 'vitest';
import {
  layoutStackCenters,
  pieceBaseY,
  PLAYFIELD_SURFACE_Y,
  stackExtent,
  type StackMeasure,
} from './stack-layout';
import type { EnginePiece } from './types';

const flat = (id: string): EnginePiece => ({ id, player: 'A', shape: 'flat' });

describe('stack layout grounding', () => {
  const measure: StackMeasure = {
    heightOf: (_p: EnginePiece) => 0.18,
    offsetOf: (_p: EnginePiece, _i: number, _s: EnginePiece[]) => 0,
  };

  it('bottom piece base equals playfield surface', () => {
    const centers = layoutStackCenters([flat('a'), flat('b')], measure, PLAYFIELD_SURFACE_Y);
    expect(pieceBaseY(centers[0]!, measure.heightOf(flat('a')))).toBeCloseTo(PLAYFIELD_SURFACE_Y, 6);
    expect(pieceBaseY(centers[1]!, measure.heightOf(flat('b')))).toBeCloseTo(0.18, 6);
  });

  it('stack extent matches sum of heights when offsets are zero', () => {
    const stack = [flat('a'), flat('b'), flat('c')];
    expect(stackExtent(stack, measure)).toBeCloseTo(0.18 * 3, 6);
  });

  it('applies verticalOffset to stack step', () => {
    const ring = { id: 'r', player: 'A', shape: 'ring' };
    const marker = { id: 'm', player: 'A', shape: 'marker' };
    const yinsh = {
      heightOf: (p: EnginePiece) => (p.shape === 'marker' ? 0.012 : 0.05),
      offsetOf: (p: EnginePiece, index: number, s: EnginePiece[]) =>
        p.shape === 'marker' && index > 0 && s.slice(0, index).some(x => x.shape === 'ring') ? -0.038 : 0,
    };
    const centers = layoutStackCenters([ring, marker], yinsh);
    expect(pieceBaseY(centers[0]!, yinsh.heightOf(ring))).toBeCloseTo(0, 6);
    expect(centers[1]).toBeLessThan(centers[0]! + yinsh.heightOf(ring) / 2 + yinsh.heightOf(marker) / 2);
  });
});
