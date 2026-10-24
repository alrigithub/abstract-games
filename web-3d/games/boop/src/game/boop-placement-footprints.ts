import type { PieceKind } from './types';

/** Large vase tile footprint (world units); kitten uses vase width ratio 22.6 / 33. */
export const BOOP_CAT_FOOTPRINT_WORLD = 0.8 * 1.2;
export const BOOP_KITTEN_FOOTPRINT_WORLD = BOOP_CAT_FOOTPRINT_WORLD * (22.6 / 33);

export function boopFootprintWorldUnits(kind: PieceKind): number {
  return kind === 'cat' ? BOOP_CAT_FOOTPRINT_WORLD : BOOP_KITTEN_FOOTPRINT_WORLD;
}
