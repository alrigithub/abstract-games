import type { EnginePiece } from './types';

/** Top of the board slab / table; grid lines sit slightly above this. */
export const PLAYFIELD_SURFACE_Y = 0;

export type StackMeasure = {
  heightOf(piece: EnginePiece): number;
  offsetOf(piece: EnginePiece, index: number, stack: EnginePiece[]): number;
};

/** World Y of each piece mesh center; bases stack flush on `surfaceY` (respecting verticalOffset). */
export function layoutStackCenters(
  stack: EnginePiece[],
  measure: StackMeasure,
  surfaceY: number = PLAYFIELD_SURFACE_Y,
): number[] {
  const centers: number[] = [];
  let stackTop = surfaceY;
  for (let i = 0; i < stack.length; i++) {
    const piece = stack[i]!;
    const h = measure.heightOf(piece);
    const offset = measure.offsetOf(piece, i, stack);
    centers.push(stackTop + h / 2 + offset);
    stackTop += h + offset;
  }
  return centers;
}

/** Lowest Y of a piece given its center, height, and verticalOffset (offset shifts center, not base alone). */
export function pieceBaseY(centerY: number, height: number): number {
  return centerY - height / 2;
}

/** Total occupied height above `surfaceY` for a stack. */
export function stackExtent(
  stack: EnginePiece[],
  measure: StackMeasure,
  surfaceY: number = PLAYFIELD_SURFACE_Y,
): number {
  if (!stack.length) return 0;
  const centers = layoutStackCenters(stack, measure, surfaceY);
  const last = stack.length - 1;
  const h = measure.heightOf(stack[last]!);
  const offset = measure.offsetOf(stack[last]!, last, stack);
  return centers[last]! + h / 2 + offset - surfaceY;
}
