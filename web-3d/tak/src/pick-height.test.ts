import { INTERACTION } from '@abstract/three-engine';
import { describe, expect, it } from 'vitest';
import { countSelected } from './state';
import { stackPickLimit } from './pick-height';
import type { Piece } from './types';

function flat(color: Piece['color'], id: string): Piece {
  return { id, color, kind: 'stone', orientation: 'flat' };
}

describe('press-and-hold stack growth', () => {
  it('grows one piece every HOLD_INTERVAL up to owned-from-top and carry limit', () => {
    const stack = [flat('charcoal', 'b1'), flat('ivory', 'i1'), flat('ivory', 'i2'), flat('ivory', 'i3')];
    const limit = stackPickLimit(stack, 'ivory', true, 5);
    expect(limit).toBe(3);

    const interval = INTERACTION.HOLD_INTERVAL;
    expect(countSelected(0, limit, interval)).toBe(1);
    expect(countSelected(interval - 1, limit, interval)).toBe(1);
    expect(countSelected(interval, limit, interval)).toBe(2);
    expect(countSelected(interval * 2, limit, interval)).toBe(3);
    expect(countSelected(interval * 10, limit, interval)).toBe(3);
  });

  it('caps at carry limit even when more owned pieces exist', () => {
    const stack = Array.from({ length: 7 }, (_, i) => flat('ivory', `i${i}`));
    const limit = stackPickLimit(stack, 'ivory', true, 5);
    expect(limit).toBe(5);
    expect(countSelected(INTERACTION.HOLD_INTERVAL * 4, limit, INTERACTION.HOLD_INTERVAL)).toBe(5);
  });

  it('does not cap sandbox piles on exterior cells', () => {
    const stack = Array.from({ length: 7 }, (_, i) => flat('ivory', `i${i}`));
    expect(stackPickLimit(stack, 'ivory', false, 5)).toBe(7);
  });
});
