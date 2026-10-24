import { carryLimit, ownedFromTop } from './game/engine';
import type { Color, Piece } from './types';

/** How many pieces press-and-hold may add while staying on this stack. */
export function stackPickLimit(
  stack: Piece[],
  mover: Color | null,
  playableCell: boolean,
  size: number,
): number {
  if (!stack.length) return 0;
  if (!playableCell || !mover) return stack.length;
  return Math.min(carryLimit(size), ownedFromTop(stack, mover));
}
