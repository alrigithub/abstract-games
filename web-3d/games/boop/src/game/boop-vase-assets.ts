export type BoopVasePlayerId = 'A' | 'B';
export type BoopVaseVariant = 'cat' | 'kitten';

/** Alex stone-mixed-final vase GLBs (internal root names match filenames). */
export const BOOP_VASE_GLB: Record<BoopVasePlayerId, Record<BoopVaseVariant, string>> = {
  A: {
    kitten: 'vase-small-white.glb',
    cat: 'vase-large-white.glb',
  },
  B: {
    kitten: 'vase-small-black.glb',
    cat: 'vase-large-black.glb',
  },
};

/** Expected byte sizes (meshopt + WebP); guards against swapped copies in public/assets/vases. */
export const BOOP_VASE_GLB_BYTE_SIZE: Record<string, number> = {
  'vase-small-white.glb': 285_280,
  'vase-large-white.glb': 314_448,
  'vase-small-black.glb': 422_436,
  'vase-large-black.glb': 432_724,
};

export function boopVaseGlbFor(player: BoopVasePlayerId, variant: BoopVaseVariant): string {
  return BOOP_VASE_GLB[player][variant];
}
